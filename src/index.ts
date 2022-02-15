import { Janitor } from "@rbxts/janitor";
import { Players, ProximityPromptService, TextService, TweenService, UserInputService } from "@rbxts/services";

const LocalPlayer = Players.LocalPlayer as Player & {PlayerGui: PlayerGui};
const PlayerGui: PlayerGui = LocalPlayer.PlayerGui

const GamepadButtonImage = new Map<Enum.KeyCode, string>([
    [Enum.KeyCode.ButtonX, "rbxasset://textures/ui/Controls/xboxX.png"],
    [Enum.KeyCode.ButtonY, "rbxasset://textures/ui/Controls/xboxY.png"],
    [Enum.KeyCode.ButtonA, "rbxasset://textures/ui/Controls/xboxA.png"],
    [Enum.KeyCode.ButtonB, "rbxasset://textures/ui/Controls/xboxB.png"],
    [Enum.KeyCode.DPadLeft, "rbxasset://textures/ui/Controls/dpadLeft.png"],
    [Enum.KeyCode.DPadRight, "rbxasset://textures/ui/Controls/dpadRight.png"],
    [Enum.KeyCode.DPadUp, "rbxasset://textures/ui/Controls/dpadUp.png"],
    [Enum.KeyCode.DPadDown, "rbxasset://textures/ui/Controls/dpadDown.png"],
    [Enum.KeyCode.ButtonSelect, "rbxasset://textures/ui/Controls/xboxmenu.png"],
    [Enum.KeyCode.ButtonL1, "rbxasset://textures/ui/Controls/xboxLS.png"],
    [Enum.KeyCode.ButtonR1, "rbxasset://textures/ui/Controls/xboxRS.png"],
]);

const KeyboardButtonImage = new Map<Enum.KeyCode, string>([
    [Enum.KeyCode.Backspace, "rbxasset://textures/ui/Controls/backspace.png"],
    [Enum.KeyCode.Return, "rbxasset://textures/ui/Controls/return.png"],
    [Enum.KeyCode.LeftShift, "rbxasset://textures/ui/Controls/shift.png"],
    [Enum.KeyCode.RightShift, "rbxasset://textures/ui/Controls/shift.png"],
    [Enum.KeyCode.Tab, "rbxasset://textures/ui/Controls/tab.png"],
]);

const KeyboardButtonIconMapping = new Map<string, string>([
    ["'", "rbxasset://textures/ui/Controls/apostrophe.png"],
    [",", "rbxasset://textures/ui/Controls/comma.png"],
    ["`", "rbxasset://textures/ui/Controls/graveaccent.png"],
    [".", "rbxasset://textures/ui/Controls/period.png"],
    [" ", "rbxasset://textures/ui/Controls/spacebar.png"],
]);

const KeyCodeToTextMapping = new Map<Enum.KeyCode, string>([
    [Enum.KeyCode.LeftControl, "Ctrl"],
    [Enum.KeyCode.RightControl, "Ctrl"],
    [Enum.KeyCode.LeftAlt, "Alt"],
    [Enum.KeyCode.RightAlt, "Alt"],
    [Enum.KeyCode.F1, "F1"],
    [Enum.KeyCode.F2, "F2"],
    [Enum.KeyCode.F3, "F3"],
    [Enum.KeyCode.F4, "F4"],
    [Enum.KeyCode.F5, "F5"],
    [Enum.KeyCode.F6, "F6"],
    [Enum.KeyCode.F7, "F7"],
    [Enum.KeyCode.F8, "F8"],
    [Enum.KeyCode.F9, "F9"],
    [Enum.KeyCode.F10, "F10"],
    [Enum.KeyCode.F11, "F11"],
    [Enum.KeyCode.F12, "F12"],
]);

const getScreenGui = (): ScreenGui => {
    let screenGui = PlayerGui.FindFirstChild("ProximityPrompts") as ScreenGui | undefined;
    if (!screenGui)
    {
        screenGui = new Instance("ScreenGui");
        screenGui.Name = "ProximityPrompts";
    	screenGui.ResetOnSpawn = false;
    	screenGui.Parent = PlayerGui;
    }
    return screenGui;
}

const createProgressBarGradient = (parent: Instance, leftSide: boolean) => {
    let frame = new Instance("Frame");
    frame.Size = UDim2.fromScale(0.5, 1)
    frame.Position = UDim2.fromScale(leftSide ? 0 : 0.5, 0)
    frame.BackgroundTransparency = 1
    frame.ClipsDescendants = true
    frame.Parent = parent

    let image = new Instance("ImageLabel")
    image.BackgroundTransparency = 1
    image.Size = UDim2.fromScale(2, 1)
    image.Position = UDim2.fromScale(leftSide ? 0 : -1, 0)
    image.Image = "rbxasset://textures/ui/Controls/RadialFill.png"
    image.Parent = frame

    let gradient = new Instance("UIGradient")
    gradient.Transparency = new NumberSequence([
    	new NumberSequenceKeypoint(0, 0),
    	new NumberSequenceKeypoint(.4999, 0),
    	new NumberSequenceKeypoint(.5, 1),
    	new NumberSequenceKeypoint(1, 1)
    ])
    gradient.Rotation = leftSide ? 180 : 0
    gradient.Parent = image

    return gradient;
}

const createCircularProgressBar = (): Frame & {Progress: NumberValue} => {
    let bar = new Instance("Frame")
    bar.Name = "CircularProgressBar"
    bar.Size = UDim2.fromOffset(58, 58)
    bar.AnchorPoint = new Vector2(0.5, 0.5)
    bar.Position = UDim2.fromScale(0.5, 0.5)
    bar.BackgroundTransparency = 1

    let gradient1 = createProgressBarGradient(bar, true);
    let gradient2 = createProgressBarGradient(bar, false);

    let progress = new Instance("NumberValue");
    progress.Name = "Progress";
    progress.Parent = bar;
    progress.Changed.Connect((value) => {
        let angle = math.clamp(value * 360, 0, 360);
        gradient1.Rotation = math.clamp(angle, 180, 360);
        gradient2.Rotation = math.clamp(angle, 0, 180);
    });

    return bar as Frame & {Progress: NumberValue};
}

export class ProximityPromptListener {
    private janitor = new Janitor();

    private prompt;

    private tweensForButtonHoldBegin = new Array<Tween>();
    private tweensForButtonHoldEnd = new Array<Tween>();
    private tweensForFadeOut = new Array<Tween>();
    private tweensForFadeIn = new Array<Tween>();


    private tweenInfoInFullDuration;
    private tweenInfoOutHalfSecond = new TweenInfo(0.5, Enum.EasingStyle.Quad, Enum.EasingDirection.Out);
    private tweenInfoFast = new TweenInfo(0.2, Enum.EasingStyle.Quad, Enum.EasingDirection.Out);
    private tweenInfoQuick = new TweenInfo(0.06, Enum.EasingStyle.Linear, Enum.EasingDirection.Out);

    private promptUI = this.janitor.Add(new Instance("BillboardGui"));
    private frame = this.janitor.Add(new Instance("Frame"));
    private roundedCorner = this.janitor.Add(new Instance("UICorner"));
    private inputFrame = this.janitor.Add(new Instance("Frame"));
    private resizeableInputFrame = this.janitor.Add(new Instance("Frame"));
    private inputFrameScaler = this.janitor.Add(new Instance("UIScale"));
    private actionText = this.janitor.Add(new Instance("TextLabel"));
    private objectText = this.janitor.Add(new Instance("TextLabel"));
    private roundFrame = this.janitor.Add(new Instance("Frame"));
    private roundedFrameCorner = this.janitor.Add(new Instance("UICorner"));

    private nonStatic_icon = this.janitor.Add(new Instance("ImageLabel"));
    private nonStatic_icon2 = this.janitor.Add(new Instance("ImageLabel"));
    private nonStatic_buttonImage = this.janitor.Add(new Instance("ImageLabel"));
    private nonStatic_buttonText = this.janitor.Add(new Instance("TextLabel"));
    private nonStatic_button = this.janitor.Add(new Instance("TextButton"));

    private nonStatic_circleBar = this.janitor.Add(createCircularProgressBar());

    private LifecycleJanitor = this.janitor.Add(new Janitor());

    constructor(prompt: ProximityPrompt) {
        this.prompt = prompt;
        this.tweenInfoInFullDuration = new TweenInfo(prompt.HoldDuration, Enum.EasingStyle.Linear, Enum.EasingDirection.Out)
        this.janitor.Add(prompt.GetPropertyChangedSignal("HoldDuration").Connect(() => this.tweenInfoInFullDuration = new TweenInfo(prompt.HoldDuration, Enum.EasingStyle.Linear, Enum.EasingDirection.Out)));
        this.janitor.Add(() => {
            this.tweensForButtonHoldBegin.clear();
            this.tweensForButtonHoldEnd.clear();
            this.tweensForFadeOut.clear();
            this.tweensForFadeIn.clear();
        });
        this.promptUI.Name = "Prompt";
        this.promptUI.AlwaysOnTop = true;

        this.frame.Size = UDim2.fromScale(0.5, 1);
    	this.frame.BackgroundTransparency = 1;
    	this.frame.BackgroundColor3 = new Color3(0.07, 0.07, 0.07);
    	this.frame.Parent = this.promptUI;

        this.roundedCorner.Parent = this.frame;

        this.inputFrame.Name = "InputFrame";
        this.inputFrame.Size = UDim2.fromScale(1, 1);
        this.inputFrame.BackgroundTransparency = 1;
        this.inputFrame.SizeConstraint = Enum.SizeConstraint.RelativeYY;
        this.inputFrame.Parent = this.frame;

        this.resizeableInputFrame.Size = UDim2.fromScale(1, 1);
    	this.resizeableInputFrame.Position = UDim2.fromScale(0.5, 0.5);
    	this.resizeableInputFrame.AnchorPoint = new Vector2(0.5, 0.5);
    	this.resizeableInputFrame.BackgroundTransparency = 1;
    	this.resizeableInputFrame.Parent = this.inputFrame;

        this.inputFrameScaler.Parent = this.resizeableInputFrame;

        this.actionText.Name = "ActionText";
    	this.actionText.Size = UDim2.fromScale(1, 1);
    	this.actionText.Font = Enum.Font.GothamSemibold;
    	this.actionText.TextSize = 19;
    	this.actionText.BackgroundTransparency = 1;
    	this.actionText.TextTransparency = 1;
    	this.actionText.TextColor3 = new Color3(1, 1, 1);
    	this.actionText.TextXAlignment = Enum.TextXAlignment.Left;
    	this.actionText.Parent = this.frame;

        this.tweensForButtonHoldBegin.push(TweenService.Create(this.actionText, this.tweenInfoFast, { TextTransparency: 1 }));
    	this.tweensForButtonHoldEnd.push(TweenService.Create(this.actionText, this.tweenInfoFast, { TextTransparency: 0 }));
    	this.tweensForFadeOut.push(TweenService.Create(this.actionText, this.tweenInfoFast, { TextTransparency: 1 }));
    	this.tweensForFadeIn.push(TweenService.Create(this.actionText, this.tweenInfoFast, { TextTransparency: 0 }));

        this.objectText.Name = "ObjectText";
    	this.objectText.Size = UDim2.fromScale(1, 1);
    	this.objectText.Font = Enum.Font.GothamSemibold;
    	this.objectText.TextSize = 14;
    	this.objectText.BackgroundTransparency = 1;
    	this.objectText.TextTransparency = 1;
    	this.objectText.TextColor3 = new Color3(0.7, 0.7, 0.7);
    	this.objectText.TextXAlignment = Enum.TextXAlignment.Left;
    	this.objectText.Parent = this.frame;

        this.tweensForButtonHoldBegin.push(TweenService.Create(this.objectText, this.tweenInfoFast, { TextTransparency: 1 }));
    	this.tweensForButtonHoldEnd.push(TweenService.Create(this.objectText, this.tweenInfoFast, { TextTransparency: 0 }));
    	this.tweensForFadeOut.push(TweenService.Create(this.objectText, this.tweenInfoFast, { TextTransparency: 1 }));
    	this.tweensForFadeIn.push(TweenService.Create(this.objectText, this.tweenInfoFast, { TextTransparency: 0 }));

    	this.tweensForButtonHoldBegin.push(TweenService.Create(this.frame, this.tweenInfoFast, { Size: UDim2.fromScale(0.5, 1), BackgroundTransparency: 1 }));
    	this.tweensForButtonHoldEnd.push(TweenService.Create(this.frame, this.tweenInfoFast, { Size: UDim2.fromScale(1, 1), BackgroundTransparency: 0.2 }));
    	this.tweensForFadeOut.push(TweenService.Create(this.frame, this.tweenInfoFast, { Size: UDim2.fromScale(0.5, 1), BackgroundTransparency: 1 }));
    	this.tweensForFadeIn.push(TweenService.Create(this.frame, this.tweenInfoFast, { Size: UDim2.fromScale(1, 1), BackgroundTransparency: 0.2 }));

        this.roundFrame.Name = "RoundFrame";
        this.roundFrame.Size = UDim2.fromOffset(48, 48);
     
    	this.roundFrame.AnchorPoint = new Vector2(0.5, 0.5);
    	this.roundFrame.Position = UDim2.fromScale(0.5, 0.5);
    	this.roundFrame.BackgroundTransparency = 1;
    	this.roundFrame.Parent = this.resizeableInputFrame;

        this.roundedFrameCorner.CornerRadius = new UDim(0.5, 0);
        this.roundedFrameCorner.Parent = this.roundFrame;

        this.tweensForFadeOut.push(TweenService.Create(this.roundFrame, this.tweenInfoQuick, { BackgroundTransparency: 1 }));
    	this.tweensForFadeIn.push(TweenService.Create(this.roundFrame, this.tweenInfoQuick, { BackgroundTransparency: 0.5 }));

        this.janitor.Add(ProximityPromptService.PromptShown.Connect((prompt, inputType) => {
            if (prompt.Style === Enum.ProximityPromptStyle.Default || prompt !== this.prompt)
                return;

                this.GenerateChangingTextAndVisuals(inputType);
                let inputFrameScaleFactor = inputType === Enum.ProximityPromptInputType.Touch ? 1.6 : 1.33
                this.tweensForButtonHoldBegin.push(TweenService.Create(this.inputFrameScaler, this.tweenInfoFast, { Scale: inputFrameScaleFactor }));
                this.tweensForButtonHoldEnd.push(TweenService.Create(this.inputFrameScaler, this.tweenInfoFast, { Scale: 1 }))
            
            let gui = getScreenGui();
            prompt.PromptHidden.Wait();
            this.hideAway();
        }));
    }
    
    private GenerateChangingTextAndVisuals(inputType: Enum.ProximityPromptInputType) {
        this.nonStatic_icon.Parent = undefined;
        this.nonStatic_icon2.Parent = undefined;
        this.nonStatic_buttonImage.Parent = undefined;
        this.nonStatic_buttonText.Parent = undefined;
        this.nonStatic_button.Parent = undefined;
        this.nonStatic_circleBar.Parent = undefined;

        this.LifecycleJanitor.Destroy();
        this.LifecycleJanitor = this.janitor.Add(new Janitor());
        switch(inputType)
        {
            case Enum.ProximityPromptInputType.Gamepad:
                if (GamepadButtonImage.get(this.prompt.GamepadKeyCode)) {
                    this.nonStatic_icon.Name = "ButtonImage"
                    this.nonStatic_icon.AnchorPoint = new Vector2(0.5, 0.5)
                    this.nonStatic_icon.Size = UDim2.fromOffset(24, 24)
                    this.nonStatic_icon.Position = UDim2.fromScale(0.5, 0.5)
                    this.nonStatic_icon.BackgroundTransparency = 1
                    this.nonStatic_icon.ImageTransparency = 1
                    this.nonStatic_icon.Image = GamepadButtonImage.get(this.prompt.GamepadKeyCode) ?? ""
                    this.nonStatic_icon.Parent = this.resizeableInputFrame
                    this.tweensForFadeOut.push(TweenService.Create(this.nonStatic_icon, this.tweenInfoQuick, { ImageTransparency: 1 }));
                    this.tweensForFadeIn.push(TweenService.Create(this.nonStatic_icon, this.tweenInfoQuick, { ImageTransparency: 0 }));
                }
                break;
            case Enum.ProximityPromptInputType.Touch:
                this.nonStatic_buttonImage.Name = "ButtonImage";
                this.nonStatic_buttonImage.BackgroundTransparency = 1;
                this.nonStatic_buttonImage.ImageTransparency = 1;
                this.nonStatic_buttonImage.Size = UDim2.fromOffset(25, 31);
                this.nonStatic_buttonImage.AnchorPoint = new Vector2(0.5, 0.5);
                this.nonStatic_buttonImage.Position = UDim2.fromScale(0.5, 0.5);
                this.nonStatic_buttonImage.Image = "rbxasset://textures/ui/Controls/TouchTapIcon.png";
                this.nonStatic_buttonImage.Parent = this.resizeableInputFrame;
        
                this.tweensForFadeOut.push(TweenService.Create(this.nonStatic_buttonImage, this.tweenInfoQuick, { ImageTransparency: 1 }));
                this.tweensForFadeIn.push(TweenService.Create(this.nonStatic_buttonImage, this.tweenInfoQuick, { ImageTransparency: 0 }));
                break;

            default:
                this.nonStatic_buttonImage.Name = "ButtonImage"
                this.nonStatic_buttonImage.BackgroundTransparency = 1
                this.nonStatic_buttonImage.ImageTransparency = 1
                this.nonStatic_buttonImage.Size = UDim2.fromOffset(28, 30)
                this.nonStatic_buttonImage.AnchorPoint = new Vector2(0.5, 0.5)
                this.nonStatic_buttonImage.Position = UDim2.fromScale(0.5, 0.5)
                this.nonStatic_buttonImage.Image = "rbxasset://textures/ui/Controls/key_single.png"
                this.nonStatic_buttonImage.Parent = this.resizeableInputFrame
                this.tweensForFadeOut.push(TweenService.Create(this.nonStatic_buttonImage, this.tweenInfoQuick, { ImageTransparency: 1 }))
                this.tweensForFadeIn.push(TweenService.Create(this.nonStatic_buttonImage, this.tweenInfoQuick, { ImageTransparency: 0 }))
        
                let buttonTextString = UserInputService.GetStringForKeyCode(this.prompt.KeyboardKeyCode)
        
                let buttonTextImage = KeyboardButtonImage.get(this.prompt.KeyboardKeyCode)
                if (!buttonTextImage)
                    buttonTextImage = KeyboardButtonIconMapping.get(buttonTextString)
        
                if (!buttonTextImage)
                {
                    let keyCodeMappedText = KeyCodeToTextMapping.get(this.prompt.KeyboardKeyCode);
                    if (keyCodeMappedText)
                        buttonTextString = keyCodeMappedText
                }
        
                if (buttonTextImage)
                {
                    this.nonStatic_icon2.Name = "ButtonImage"
                    this.nonStatic_icon2.AnchorPoint = new Vector2(0.5, 0.5)
                    this.nonStatic_icon2.Size = UDim2.fromOffset(36, 36)
                    this.nonStatic_icon2.Position = UDim2.fromScale(0.5, 0.5)
                    this.nonStatic_icon2.BackgroundTransparency = 1
                    this.nonStatic_icon2.ImageTransparency = 1
                    this.nonStatic_icon2.Image = buttonTextImage ?? ""
                    this.nonStatic_icon2.Parent = this.resizeableInputFrame
                    this.tweensForFadeOut.push(TweenService.Create(this.nonStatic_icon2, this.tweenInfoQuick, { ImageTransparency: 1 }));
                    this.tweensForFadeIn.push(TweenService.Create(this.nonStatic_icon2, this.tweenInfoQuick, { ImageTransparency: 0 }));
                } 
                else if (buttonTextString && buttonTextString !== "") {
                    this.nonStatic_buttonText.Name = "ButtonText"
                    this.nonStatic_buttonText.Position = UDim2.fromOffset(0, -1)
                    this.nonStatic_buttonText.Size = UDim2.fromScale(1, 1)
                    this.nonStatic_buttonText.Font = Enum.Font.GothamSemibold
                    this.nonStatic_buttonText.TextSize = 14
                    if (buttonTextString.size() > 2)
                        this.nonStatic_buttonText.TextSize = 12
                    this.nonStatic_buttonText.BackgroundTransparency = 1
                    this.nonStatic_buttonText.TextTransparency = 1
                    this.nonStatic_buttonText.TextColor3 = new Color3(1, 1, 1)
                    this.nonStatic_buttonText.TextXAlignment = Enum.TextXAlignment.Center
                    this.nonStatic_buttonText.Text = buttonTextString
                    this.nonStatic_buttonText.Parent = this.resizeableInputFrame
                    this.tweensForFadeOut.push(TweenService.Create(this.nonStatic_buttonText, this.tweenInfoQuick, { TextTransparency: 1 }))
                    this.tweensForFadeIn.push(TweenService.Create(this.nonStatic_buttonText, this.tweenInfoQuick, { TextTransparency: 0 }))
                }
                    
                else
                    error(`ProximityPrompt ${this.prompt.Name} has an unsupported keycode for rendering UI: ${tostring(this.prompt.KeyboardKeyCode)}`);
        }
     
    	if (inputType === Enum.ProximityPromptInputType.Touch || this.prompt.ClickablePrompt) {
            this.nonStatic_button.BackgroundTransparency = 1
    		this.nonStatic_button.TextTransparency = 1
    		this.nonStatic_button.Size = UDim2.fromScale(1, 1)
    		this.nonStatic_button.Parent = this.promptUI
     
    		let buttonDown = false;
     
    		this.nonStatic_button.InputBegan.Connect((input) => {
                if ((input.UserInputType === Enum.UserInputType.Touch || input.UserInputType === Enum.UserInputType.MouseButton1) && 
                    input.UserInputState !== Enum.UserInputState.Change)
                {
                    this.prompt.InputHoldBegin();
                    buttonDown = true;
                }
            });
    		this.nonStatic_button.InputEnded.Connect((input) => {
                if (input.UserInputType === Enum.UserInputType.Touch || input.UserInputType === Enum.UserInputType.MouseButton1) {
                    if (buttonDown) {
                        buttonDown = false;
                        this.prompt.InputHoldEnd();
                    }
                }
            });
     
    		this.promptUI.Active = true
        }
     
    	if (this.prompt.HoldDuration > 0) {
    		this.nonStatic_circleBar.Parent = this.resizeableInputFrame
    		this.tweensForButtonHoldBegin.push(TweenService.Create(this.nonStatic_circleBar.Progress, this.tweenInfoInFullDuration, { Value: 1 }))
    		this.tweensForButtonHoldEnd.push(TweenService.Create(this.nonStatic_circleBar.Progress, this.tweenInfoOutHalfSecond, { Value: 0 }))
        }
     
    	
    	if (this.prompt.HoldDuration > 0)
        {
            this.LifecycleJanitor.Add(this.prompt.PromptButtonHoldBegan.Connect(() => {
                this.tweensForButtonHoldBegin.forEach((tween) => tween.Play())
            }));

            this.LifecycleJanitor.Add(this.prompt.PromptButtonHoldEnded.Connect(() => {
                this.tweensForButtonHoldEnd.forEach((tween) => tween.Play())
            }))
        }
    	
    	this.LifecycleJanitor.Add(this.prompt.Triggered.Connect(() => {
            this.tweensForFadeOut.forEach((tween) => tween.Play())
        }));

        this.LifecycleJanitor.Add(this.prompt.TriggerEnded.Connect(() => {
            this.tweensForFadeIn.forEach((tween) => tween.Play())
        }));

        const updateUIFromPrompt = () => {
            // todo: Use AutomaticSize instead of GetTextSize when that feature becomes available
    		let actionTextSize = TextService.GetTextSize(this.prompt.ActionText, 19, Enum.Font.GothamSemibold, new Vector2(1000, 1000));
    		let objectTextSize = TextService.GetTextSize(this.prompt.ObjectText, 14, Enum.Font.GothamSemibold, new Vector2(1000, 1000));
    		let maxTextWidth = math.max(actionTextSize.X, objectTextSize.X);
    		let promptHeight = 72;
    		let promptWidth = 72;
    		let textPaddingLeft = 72;
     
    		if ((this.prompt.ActionText !== undefined && this.prompt.ActionText !== '') ||
                this.prompt.ObjectText !== undefined && this.prompt.ObjectText !== '')
    			promptWidth = maxTextWidth + textPaddingLeft + 24;
    	
    		let actionTextYOffset = 0;
    		if (this.prompt.ObjectText !== undefined && this.prompt.ObjectText !== '')
    			actionTextYOffset = 9;

    		this.actionText.Position = new UDim2(0.5, textPaddingLeft - promptWidth/2, 0, actionTextYOffset);
    		this.objectText.Position = new UDim2(0.5, textPaddingLeft - promptWidth/2, 0, -10);
    	
    		this.actionText.Text = this.prompt.ActionText
    		this.objectText.Text = this.prompt.ObjectText
    		this.actionText.AutoLocalize = this.prompt.AutoLocalize
    		this.actionText.RootLocalizationTable = this.prompt.RootLocalizationTable
    		
    		this.objectText.AutoLocalize = this.prompt.AutoLocalize
    		this.objectText.RootLocalizationTable = this.prompt.RootLocalizationTable
     
    		this.promptUI.Size = UDim2.fromOffset(promptWidth, promptHeight)
    		this.promptUI.SizeOffset = new Vector2(this.prompt.UIOffset.X / this.promptUI.Size.Width.Offset, this.prompt.UIOffset.Y / this.promptUI.Size.Height.Offset);
        }
    		
        

        this.LifecycleJanitor.Add((this.prompt.Changed as RBXScriptSignal).Connect(() => updateUIFromPrompt()));
    	updateUIFromPrompt()
    	
    	this.promptUI.Adornee = this.prompt.Parent as PVInstance;
    	this.promptUI.Parent = getScreenGui();
     
    	this.tweensForFadeIn.forEach((tween) => tween.Play());
    }

    private hideAway() {
        this.LifecycleJanitor.Cleanup();

        this.tweensForFadeOut.forEach((tween) => tween.Play());

        task.delay(0.2, () => this.promptUI.Parent = undefined);
    }
    destroy() {
        this.janitor.Destroy();
    }
}
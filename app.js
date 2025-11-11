//Times/app.js 時間步調管理系統，可以設計各種計時器，例如泡綠茶、沖咖啡、養身操、超慢跑、單槓運動、跳繩、泡各種茶

// 單一步驟（名稱 + 秒數）
class Step {
	constructor(name, seconds) {
		this.name = name;
		this.seconds = Math.max(0, Math.floor(seconds || 0));
	}
}

// 序列計時器：依序執行多個 Step，可自動換步，並提供暫停/繼續/重設
class SequenceTimer {
	constructor(steps = [], options = {}) {
		this.steps = steps.slice();
		this.currentIndex = 0;
		this.remainingSeconds = steps[0] ? steps[0].seconds : 0;
		this.intervalId = null;
		this.isRunning = false;
		this.totalLoops = 1;
		this.currentLoop = 1;
		this.autoRepeat = false;
		this._lastAnnouncedRemaining = null;
		this.onTick = options.onTick || (() => { });
		this.onStepChange = options.onStepChange || (() => { });
		this.onCompleted = options.onCompleted || (() => { });
		this.onBeep = options.onBeep || (() => { });
		this.onTickSound = options.onTickSound || (() => { });
		this.onSpeak = options.onSpeak || (() => { });
		this.onAnnounceRemaining = options.onAnnounceRemaining || (() => { });
	}
	get currentStep() {
		return this.steps[this.currentIndex] || null;
	}
	start() {
		if (!this.steps.length) return;
		if (this.isRunning) return;
		this.isRunning = true;
		if (this.remainingSeconds <= 0) {
			this.remainingSeconds = this.currentStep.seconds;
		}
		this.onTick(this.snapshot());
		this.intervalId = setInterval(() => {
			this.remainingSeconds -= 1;
			this.onTick(this.snapshot());
			this.onTickSound(this.snapshot());
			// 每 10 秒播報一次剩餘時間，最後 5 秒每秒播報
			if (this.remainingSeconds > 0) {
				const rs = this.remainingSeconds;
				const every10 = rs % 10 === 0 && rs >= 10;
				const final5 = rs <= 5;
				if ((every10 || final5) && this._lastAnnouncedRemaining !== rs) {
					this._lastAnnouncedRemaining = rs;
					this.onAnnounceRemaining(rs, this.snapshot());
				}
			}
			if (this.remainingSeconds <= 0) {
				this.onBeep(this.snapshot());
				if (this.currentIndex < this.steps.length - 1) {
					this.currentIndex += 1;
					this.remainingSeconds = this.currentStep.seconds;
					this._lastAnnouncedRemaining = null;
					this.onStepChange(this.snapshot());
					this.onSpeak(this.currentStep.name);
				} else {
					// 一個完整序列完成
					if (this.autoRepeat || this.currentLoop < this.totalLoops) {
						this.currentLoop += 1;
						this.currentIndex = 0;
						this.remainingSeconds = this.currentStep ? this.currentStep.seconds : (this.steps[0] ? this.steps[0].seconds : 0);
						this._lastAnnouncedRemaining = null;
						this.onStepChange(this.snapshot());
						if (this.currentStep) this.onSpeak(this.currentStep.name);
					} else {
						this.stop();
						this.onCompleted(this.snapshot());
					}
				}
			}
		}, 1000);
	}
	pause() {
		if (!this.isRunning) return;
		this.isRunning = false;
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}
	stop() {
		this.pause();
	}
	reset() {
		this.pause();
		this.currentIndex = 0;
		this.remainingSeconds = this.steps[0] ? this.steps[0].seconds : 0;
		this.currentLoop = 1;
		this._lastAnnouncedRemaining = null;
		this.onTick(this.snapshot());
	}
	snapshot() {
		return {
			steps: this.steps.slice(),
			currentIndex: this.currentIndex,
			currentStep: this.currentStep,
			remainingSeconds: this.remainingSeconds,
			totalLoops: this.totalLoops,
			currentLoop: this.currentLoop,
			isRunning: this.isRunning
		};
	}
	replaceSteps(steps) {
		this.steps = steps.slice();
		this.reset();
	}
	setLoops(n) {
		const v = Math.max(1, Math.floor(n || 1));
		this.totalLoops = v;
		this.currentLoop = 1;
	}
	setAutoRepeat(enabled) {
		this.autoRepeat = !!enabled;
	}
}

// 提示：使用 Web Audio 產生簡單嗶聲（可關閉）
class Beeper {
	constructor() {
		this.enabled = true;
		this.audioContext = null;
	}
	setEnabled(enabled) {
		this.enabled = !!enabled;
	}
	beep(durationMs = 180, frequency = 880) {
		if (!this.enabled) return;
		try {
			if (!this.audioContext) {
				this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
			}
			const ctx = this.audioContext;
			const oscillator = ctx.createOscillator();
			const gain = ctx.createGain();
			oscillator.frequency.value = frequency;
			oscillator.type = "sine";
			gain.gain.setValueAtTime(0.001, ctx.currentTime);
			gain.gain.exponentialRampToValueAtTime(0.1, ctx.currentTime + 0.02);
			gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
			oscillator.connect(gain).connect(ctx.destination);
			oscillator.start();
			oscillator.stop(ctx.currentTime + durationMs / 1000);
		} catch (e) {
			// 忽略音訊錯誤
		}
	}
	tick() {
		this.beep(60, 1200);
	}
}

// 簡單語音（Web Speech API）
class Speaker {
	constructor() {
		this.enabled = true;
	}
	setEnabled(enabled) {
		this.enabled = !!enabled;
	}
	speak(text) {
		if (!this.enabled) return;
		try {
			const utter = new SpeechSynthesisUtterance(String(text || ""));
			utter.lang = detectLang(text);
			utter.rate = 1.0;
			utter.pitch = 1.0;
			window.speechSynthesis.speak(utter);
		} catch (e) {
			// 忽略語音錯誤
		}
	}
	speakAsync(text) {
		return new Promise((resolve) => {
			if (!this.enabled) { resolve(); return; }
			try {
				const utter = new SpeechSynthesisUtterance(String(text || ""));
				utter.lang = detectLang(text);
				utter.rate = 1.0;
				utter.pitch = 1.0;
				utter.onend = () => resolve();
				utter.onerror = () => resolve();
				window.speechSynthesis.speak(utter);
			} catch {
				resolve();
			}
		});
	}
}

// 預設 Presets：改由外部 presets.json 載入，並提供內建後援資料
const DEFAULT_DAILY_PRESETS = [
	{
		name: "咖啡手沖（4 分）",
		steps: [
			{ name: "悶蒸", seconds: 30 },
			{ name: "注水一", seconds: 60 },
			{ name: "注水二", seconds: 60 },
			{ name: "注水三", seconds: 60 },
			{ name: "悶萃完成", seconds: 30 }
		]
	},
	{
		name: "養身操（暖身 5 分）",
		steps: [
			{ name: "頸肩放鬆", seconds: 60 },
			{ name: "手臂環繞", seconds: 60 },
			{ name: "腰部扭轉", seconds: 60 },
			{ name: "髖關節活動", seconds: 60 },
			{ name: "膝踝活動", seconds: 60 }
		]
	},
	{
		name: "單槓（5 組：做+休）",
		steps: [
			{ name: "做第 1 組", seconds: 30 },
			{ name: "休息", seconds: 60 },
			{ name: "做第 2 組", seconds: 30 },
			{ name: "休息", seconds: 60 },
			{ name: "做第 3 組", seconds: 30 },
			{ name: "休息", seconds: 60 },
			{ name: "做第 4 組", seconds: 30 },
			{ name: "休息", seconds: 60 },
			{ name: "做第 5 組", seconds: 30 }
		]
	},
	{
		name: "跳繩（間歇 8 組）",
		steps: [
			{ name: "跳繩", seconds: 45 },
			{ name: "休息", seconds: 30 },
			{ name: "跳繩", seconds: 45 },
			{ name: "休息", seconds: 30 },
			{ name: "跳繩", seconds: 45 },
			{ name: "休息", seconds: 30 },
			{ name: "跳繩", seconds: 45 },
			{ name: "休息", seconds: 30 }
		]
	},
	{
		name: "10 分鐘整理工作環境",
		steps: [
			{ name: "分類桌面物品", seconds: 240 },
			{ name: "擦拭桌面與設備", seconds: 180 },
			{ name: "收納與歸位", seconds: 180 }
		]
	},
	{
		name: "20 分鐘番茄鐘",
		steps: [
			{ name: "專注工作", seconds: 1200 }
		]
	},
	{
		name: "20 分鐘專注閱讀",
		steps: [
			{ name: "設定閱讀環境", seconds: 60 },
			{ name: "專注閱讀", seconds: 1020 },
			{ name: "摘要與筆記", seconds: 120 }
		]
	},
	{
		name: "5 分鐘深呼吸放鬆",
		steps: [
			{ name: "調整坐姿與呼吸", seconds: 60 },
			{ name: "節奏呼吸：吸 4 秒、吐 6 秒", seconds: 180 },
			{ name: "緩慢伸展與收心", seconds: 60 }
		]
	},
	{
		name: "15 分鐘晨間啟動",
		steps: [
			{ name: "開窗通風＋喝水", seconds: 180 },
			{ name: "喚醒式伸展", seconds: 360 },
			{ name: "快速列出今日三件事", seconds: 360 }
		]
	},
	{
		name: "30 分鐘家務巡迴",
		steps: [
			{ name: "整理起居空間", seconds: 600 },
			{ name: "廚房與餐桌清潔", seconds: 600 },
			{ name: "浴室與地面巡檢", seconds: 600 }
		]
	},
	{
		name: "45 分鐘專案衝刺",
		steps: [
			{ name: "確認目標與分工", seconds: 300 },
			{ name: "集中執行", seconds: 2100 },
			{ name: "成果整理與筆記", seconds: 180 },
			{ name: "短暫伸展休息", seconds: 120 }
		]
	},
	{
		name: "60 分鐘學習時段",
		steps: [
			{ name: "複習與暖身閱讀", seconds: 600 },
			{ name: "深入學習／實作", seconds: 2400 },
			{ name: "整理重點與反思", seconds: 600 }
		]
	}
];
const DEFAULT_TEA_PRESETS = [
	{
		name: "茶藝師：日常綠茶",
		steps: [
			{ name: "溫杯暖壺", seconds: 45 },
			{ name: "置茶醒茶", seconds: 30 },
			{ name: "第一泡浸潤", seconds: 60 },
			{ name: "倒出分杯", seconds: 30 },
			{ name: "第二泡浸泡", seconds: 45 },
			{ name: "分杯品飲", seconds: 45 }
		]
	},
	{
		name: "茶藝師：台灣高山烏龍",
		steps: [
			{ name: "溫杯暖壺", seconds: 60 },
			{ name: "置茶搖香", seconds: 45 },
			{ name: "第一泡快速淋洗", seconds: 25 },
			{ name: "第二泡浸泡", seconds: 50 },
			{ name: "聞香品茗", seconds: 60 },
			{ name: "第三泡回沖", seconds: 55 },
			{ name: "分享茶湯", seconds: 60 }
		]
	},
	{
		name: "茶藝師：紅茶（阿薩姆/紅玉）",
		steps: [
			{ name: "溫壺與茶海", seconds: 40 },
			{ name: "置茶悶香", seconds: 35 },
			{ name: "第一泡浸潤", seconds: 75 },
			{ name: "分杯品飲", seconds: 45 },
			{ name: "第二泡浸泡", seconds: 90 },
			{ name: "第三泡加蓋萃取", seconds: 110 }
		]
	},
	{
		name: "茶藝師：普洱熟茶",
		steps: [
			{ name: "溫杯驅味", seconds: 50 },
			{ name: "置茶喚醒", seconds: 40 },
			{ name: "洗茶（棄湯）", seconds: 20 },
			{ name: "第一泡浸泡", seconds: 45 },
			{ name: "第二泡浸泡", seconds: 60 },
			{ name: "第三泡浸泡", seconds: 75 },
			{ name: "第四泡慢萃", seconds: 90 }
		]
	},
	{
		name: "茶藝師：茉莉花茶",
		steps: [
			{ name: "溫杯暖壺", seconds: 45 },
			{ name: "置茶舒展", seconds: 30 },
			{ name: "第一泡浸泡", seconds: 50 },
			{ name: "倒出分杯", seconds: 35 },
			{ name: "第二泡浸泡", seconds: 55 },
			{ name: "第三泡浸泡", seconds: 65 }
		]
	},
	{
		name: "茶藝師：玫瑰花茶",
		steps: [
			{ name: "溫杯暖壺", seconds: 40 },
			{ name: "置花醒香", seconds: 35 },
			{ name: "蜂蜜/果乾預溶", seconds: 45 },
			{ name: "浸泡釋香", seconds: 90 },
			{ name: "分杯品飲", seconds: 45 },
			{ name: "第二泡回沖", seconds: 110 }
		]
	},
	{
		name: "茶藝師：洛神果茶（冰鎮）",
		steps: [
			{ name: "沖洗茶具", seconds: 30 },
			{ name: "溫水醒洛神", seconds: 45 },
			{ name: "熱泡釋色", seconds: 120 },
			{ name: "加冰鎮涼", seconds: 90 },
			{ name: "加蜜/果汁調味", seconds: 60 },
			{ name: "裝瓶或分杯", seconds: 60 }
		]
	},
	{
		name: "茶藝師：袋泡茶快速沖泡",
		steps: [
			{ name: "準備熱水與茶包", seconds: 30 },
			{ name: "預熱杯具", seconds: 45 },
			{ name: "浸泡沖泡", seconds: 120 },
			{ name: "輕壓取出茶包", seconds: 30 },
			{ name: "調味與攪拌", seconds: 45 }
		]
	}
];
const DEFAULT_PRESET_DATA = [...DEFAULT_DAILY_PRESETS, ...DEFAULT_TEA_PRESETS];
const FALLBACK_PRESET_MAP = normalizePresetEntries(DEFAULT_PRESET_DATA);
const DEFAULT_THEME_CONFIG = {
	defaultThemeId: "default",
	themes: [
		{
			id: "default",
			name: "日常活動與茶藝",
			description: "內建主題：運動、茶飲與日常活動計時",
			usage: "一般生活節奏安排與入門茶飲",
			presets: DEFAULT_PRESET_DATA,
			fallback: true
		}
	]
};

// UI 控制器：負責 DOM 綁定與互動流程
class UIController {
	constructor() {
		this.dom = this.queryDom();
		this.beeper = new Beeper();
		this.speaker = new Speaker();
		this.sequenceName = "";
		this._startingCountdown = false;
		this.builtinPresets = {};
		this.themeMeta = { themes: [], defaultThemeId: "" };
		this.themeMap = {};
		this.currentThemeId = "";
		this.timer = new SequenceTimer([], {
			onTick: (s) => this.render(s),
			onStepChange: (s) => { this.highlightStep(s); this.announceStepChange(s); },
			onCompleted: (s) => this.onCompleted(s),
			onBeep: () => this.beeper.beep(),
			onTickSound: () => { if (this.dom.tickToggle.checked) this.beeper.tick(); },
			onSpeak: (text) => { if (this.dom.voiceToggle.checked) this.speaker.speak(text); },
			onAnnounceRemaining: (rs) => {
				if (!this.dom.voiceToggle.checked) return;
				this.speaker.speak(formatZhRemaining(rs));
			}
		});
		this.installHandlers();
	}
	queryDom() {
		return {
			presetSelect: document.getElementById("presetSelect"),
			themeSelect: document.getElementById("themeSelect"),
			editPresetBtn: document.getElementById("editPresetBtn"),
			stepsList: document.getElementById("stepsList"),
			currentName: document.getElementById("currentName"),
			timeLeft: document.getElementById("timeLeft"),
			startBtn: document.getElementById("startBtn"),
			pauseBtn: document.getElementById("pauseBtn"),
			resetBtn: document.getElementById("resetBtn"),
			beepToggle: document.getElementById("beepToggle"),
			tickToggle: document.getElementById("tickToggle"),
			voiceToggle: document.getElementById("voiceToggle"),
			loopsInput: document.getElementById("loopsInput"),
			autoRepeatToggle: document.getElementById("autoRepeatToggle"),
			editorBackdrop: document.getElementById("editorBackdrop"),
			editorClose: document.getElementById("editorClose"),
			customName: document.getElementById("customName"),
			addStepBtn: document.getElementById("addStepBtn"),
			editorSteps: document.getElementById("editorSteps"),
			saveCustomBtn: document.getElementById("saveCustomBtn"),
			deleteCustomBtn: document.getElementById("deleteCustomBtn")
		};
	}
	async initialize(themeMeta = null) {
		this.themeMeta = themeMeta || { themes: [], defaultThemeId: "" };
		const themes = Array.isArray(this.themeMeta.themes) ? this.themeMeta.themes.filter(Boolean) : [];
		this.themeMap = {};
		themes.forEach((theme) => {
			if (!theme || !theme.id) return;
			this.themeMap[theme.id] = theme;
		});
		this.populateThemeSelect(themes);
		const defaultThemeId = this.resolveDefaultThemeId(themes, this.themeMeta.defaultThemeId);
		if (defaultThemeId && this.dom.themeSelect) {
			this.dom.themeSelect.value = defaultThemeId;
		}
		await this.switchTheme(defaultThemeId, { force: true });
		this.render(this.timer.snapshot());
	}
	populateThemeSelect(themes = []) {
		const sel = this.dom.themeSelect;
		if (!sel) return;
		sel.innerHTML = "";
		themes.forEach((theme) => {
			const opt = document.createElement("option");
			opt.value = theme.id;
			opt.textContent = theme.name || theme.id;
			const tooltip = [theme.description, theme.usage].filter(Boolean).join("｜");
			opt.title = tooltip || "";
			sel.appendChild(opt);
		});
	}
	resolveDefaultThemeId(themes = [], preferredId = "") {
		if (preferredId && themes.some((t) => t.id === preferredId)) {
			return preferredId;
		}
		return themes.length ? themes[0].id : "";
	}
	async switchTheme(themeId, options = {}) {
		const targetId = themeId || this.currentThemeId;
		if (!targetId) {
			this.builtinPresets = { ...FALLBACK_PRESET_MAP };
			this.populatePresetSelect();
			return;
		}
		if (!options.force && targetId === this.currentThemeId && Object.keys(this.builtinPresets).length) {
			return;
		}
		const theme = this.themeMap[targetId];
		let presetMap = {};
		if (theme) {
			try {
				presetMap = await loadThemePresets(theme, FALLBACK_PRESET_MAP);
			} catch (err) {
				console.error(`載入主題「${theme.name || theme.id}」失敗：`, err);
				presetMap = { ...FALLBACK_PRESET_MAP };
			}
		} else {
			presetMap = { ...FALLBACK_PRESET_MAP };
		}
		if (!presetMap || !Object.keys(presetMap).length) {
			presetMap = { ...FALLBACK_PRESET_MAP };
		}
		this.currentThemeId = theme ? theme.id : "default";
		this.builtinPresets = presetMap;
		this.populatePresetSelect();
		if (this.dom.themeSelect && this.dom.themeSelect.value !== this.currentThemeId) {
			this.dom.themeSelect.value = this.currentThemeId;
		}
	}
	populatePresetSelect() {
		const sel = this.dom.presetSelect;
		sel.innerHTML = "";
		const userPresets = loadUserPresets();
		const builtinNames = Object.keys(this.builtinPresets);
		const customNames = Object.keys(userPresets);

		if (builtinNames.length) {
			const grp1 = document.createElement("optgroup");
			grp1.label = "內建";
			builtinNames.forEach((key) => {
				const opt = document.createElement("option");
				opt.value = `builtin::${key}`;
				opt.textContent = key;
				grp1.appendChild(opt);
			});
			sel.appendChild(grp1);
		}

		if (customNames.length) {
			const grp2 = document.createElement("optgroup");
			grp2.label = "自訂";
			customNames.forEach((key) => {
				const opt = document.createElement("option");
				opt.value = `custom::${key}`;
				opt.textContent = key;
				grp2.appendChild(opt);
			});
			sel.appendChild(grp2);
		}

		let defaultValue = "";
		if (builtinNames.length) {
			defaultValue = `builtin::${builtinNames[0]}`;
		} else if (customNames.length) {
			defaultValue = `custom::${customNames[0]}`;
		}

		if (defaultValue) {
			sel.value = defaultValue;
			this.applyPresetByValue(sel.value);
		} else {
			this.timer.replaceSteps([]);
			this.renderSteps([]);
		}
	}
	applyPresetByValue(value) {
		let steps = [];
		this.sequenceName = "";
		if (!value) {
			this.timer.replaceSteps([]);
			this.renderSteps([]);
			return;
		}
		if (value.startsWith("builtin::")) {
			const name = value.slice("builtin::".length);
			this.sequenceName = name;
			steps = (this.builtinPresets[name] || []).map(s => new Step(s.name, s.seconds));
		} else if (value.startsWith("custom::")) {
			const name = value.slice("custom::".length);
			this.sequenceName = name;
			const user = loadUserPresets();
			steps = (user[name] || []).map(s => new Step(s.name, s.seconds));
		}
		this.timer.replaceSteps(steps);
		this.renderSteps(steps);
	}
	installHandlers() {
		if (this.dom.startBtn) this.dom.startBtn.addEventListener("click", () => this.startWithAnnouncement());
		if (this.dom.pauseBtn) this.dom.pauseBtn.addEventListener("click", () => this.timer.pause());
		if (this.dom.resetBtn) this.dom.resetBtn.addEventListener("click", () => this.timer.reset());
		if (this.dom.themeSelect) this.dom.themeSelect.addEventListener("change", (e) => {
			const value = e.target.value;
			this.switchTheme(value);
		});
		if (this.dom.presetSelect) this.dom.presetSelect.addEventListener("change", (e) => this.applyPresetByValue(e.target.value));
		if (this.dom.beepToggle) this.dom.beepToggle.addEventListener("change", (e) => this.beeper.setEnabled(e.target.checked));
		if (this.dom.voiceToggle) this.dom.voiceToggle.addEventListener("change", (e) => this.speaker.setEnabled(e.target.checked));
		if (this.dom.loopsInput) this.dom.loopsInput.addEventListener("change", (e) => this.timer.setLoops(e.target.value));
		if (this.dom.autoRepeatToggle) this.dom.autoRepeatToggle.addEventListener("change", (e) => this.timer.setAutoRepeat(e.target.checked));
		if (this.dom.editPresetBtn) this.dom.editPresetBtn.addEventListener("click", () => this.openEditorWithCurrent());
		if (this.dom.editorClose) this.dom.editorClose.addEventListener("click", () => this.closeEditor());
		if (this.dom.addStepBtn) this.dom.addStepBtn.addEventListener("click", () => this.addEditorRow());
		if (this.dom.saveCustomBtn) this.dom.saveCustomBtn.addEventListener("click", () => this.saveCustom());
		if (this.dom.deleteCustomBtn) this.dom.deleteCustomBtn.addEventListener("click", () => this.deleteCurrentCustom());
		// 點擊遮罩關閉（點在空白處才關）
		if (this.dom.editorBackdrop) {
			this.dom.editorBackdrop.addEventListener("click", (e) => {
				if (e.target === this.dom.editorBackdrop) this.closeEditor();
			});
		}
		// 按 ESC 關閉
		document.addEventListener("keydown", (e) => {
			if (e.key === "Escape" && this.dom.editorBackdrop && !this.dom.editorBackdrop.hidden) this.closeEditor();
		});
		// 保險：若個別事件未綁定，改用事件委派監聽 editorClose
		document.addEventListener("click", (e) => {
			const t = e.target;
			if (t && t.id === "editorClose") this.closeEditor();
		});
	}
	renderSteps(steps) {
		const ul = this.dom.stepsList;
		ul.innerHTML = "";
		steps.forEach((s, idx) => {
			const li = document.createElement("li");
			li.dataset.index = String(idx);
			li.textContent = `${s.name} — ${formatSeconds(s.seconds)}`;
			ul.appendChild(li);
		});
	}
	highlightStep(snapshot) {
		const ul = this.dom.stepsList;
		Array.from(ul.children).forEach((li, idx) => {
			if (idx === snapshot.currentIndex) {
				li.classList.add("active");
			} else {
				li.classList.remove("active");
			}
		});
	}
	render(snapshot) {
		const step = snapshot.currentStep;
		this.dom.currentName.textContent = step ? step.name : "未選擇";
		this.dom.timeLeft.textContent = formatSeconds(snapshot.remainingSeconds || 0);
		this.highlightStep(snapshot);
	}
	onCompleted() {
		this.beeper.beep(220, 1200);
		this.beeper.beep(220, 1000);
		if (this.dom.voiceToggle.checked) {
			const name = this.sequenceName || "計時";
			this.speaker.speak(`${name}已完成`);
		}
	}

	// 語音：步驟轉換播報
	async announceStepChange(snapshot) {
		if (!this.dom.voiceToggle.checked) return;
		const step = snapshot.currentStep;
		if (!step) return;
		const prevName = this.getPrevStepName(snapshot);
		const dur = formatZhDuration(step.seconds);
		if (this._announcingStep) return;
		this._announcingStep = true;
		const wasRunning = this.timer.isRunning;
		this.timer.pause();
		if (prevName) {
			await this.speaker.speakAsync(`${prevName}完成，接下來，${step.name}，${dur}`);
		} else {
			await this.speaker.speakAsync(`第一個步驟，${step.name}，${dur}`);
		}
		this._announcingStep = false;
		// 語音後恢復計時（依需求：等待語音完成再開始/繼續）
		this.timer.start();
	}
	getPrevStepName(snapshot) {
		const i = snapshot.currentIndex;
		if (i <= 0) return "";
		const prev = snapshot.steps[i - 1];
		return prev ? prev.name : "";
	}

	// 開始流程：宣告 + 三秒倒數 + 第一步驟介紹後啟動
	async startWithAnnouncement() {
		if (this.timer.isRunning || this._startingCountdown) return;
		if (!this.timer.steps.length) return;
		this._startingCountdown = true;
		try {
			if (this.dom.voiceToggle.checked) {
				const name = this.sequenceName || "計時";
				await this.speaker.speakAsync(`${name}開始`);
			}
			// 3 秒倒數
			for (let i = 3; i >= 1; i--) {
				if (this.dom.voiceToggle.checked) await this.speaker.speakAsync(String(i));
				this.beeper.tick();
				await sleep(1000);
			}
			// 第一步驟介紹
			const first = this.timer.steps[0];
			if (first && this.dom.voiceToggle.checked) {
				await this.speaker.speakAsync(`${first.name}，${formatZhDuration(first.seconds)}`);
			}
			this.timer.start();
		} finally {
			this._startingCountdown = false;
		}
	}
	// 編輯器
	openEditorWithCurrent() {
		const val = this.dom.presetSelect.value;
		let steps = this.timer.steps.map(s => new Step(s.name, s.seconds));
		let name = "";
		if (val.startsWith("custom::")) name = val.slice("custom::".length);
		this.dom.customName.value = name;
		this.dom.editorSteps.innerHTML = "";
		steps.forEach(s => this.addEditorRow(s.name, s.seconds));
		if (steps.length === 0) this.addEditorRow();
		this.dom.editorBackdrop.hidden = false;
	}
	closeEditor() {
		this.dom.editorBackdrop.hidden = true;
	}
	addEditorRow(name = "", seconds = 60) {
		const wrap = document.createElement("div");
		wrap.className = "editor-step";
		const nameInput = document.createElement("input");
		nameInput.type = "text";
		nameInput.placeholder = "步驟名稱";
		nameInput.value = name;
		const secInput = document.createElement("input");
		secInput.type = "number";
		secInput.min = "0";
		secInput.value = String(seconds);
		const tools = document.createElement("div");
		tools.className = "tools";
		const upBtn = document.createElement("button"); upBtn.className = "small"; upBtn.textContent = "上移";
		const downBtn = document.createElement("button"); downBtn.className = "small"; downBtn.textContent = "下移";
		const delBtn = document.createElement("button"); delBtn.className = "danger small"; delBtn.textContent = "刪除";
		tools.appendChild(upBtn); tools.appendChild(downBtn); tools.appendChild(delBtn);
		wrap.appendChild(nameInput); wrap.appendChild(secInput); wrap.appendChild(tools);
		this.dom.editorSteps.appendChild(wrap);
		upBtn.addEventListener("click", () => {
			const prev = wrap.previousElementSibling;
			if (prev) this.dom.editorSteps.insertBefore(wrap, prev);
		});
		downBtn.addEventListener("click", () => {
			const next = wrap.nextElementSibling;
			if (next) this.dom.editorSteps.insertBefore(next, wrap);
		});
		delBtn.addEventListener("click", () => wrap.remove());
	}
	collectEditorSteps() {
		const rows = Array.from(this.dom.editorSteps.children);
		const steps = [];
		for (const row of rows) {
			const [nameInput, secInput] = row.querySelectorAll("input");
			const name = nameInput.value.trim();
			const seconds = Math.max(0, Math.floor(Number(secInput.value || 0)));
			if (!name) continue;
			steps.push(new Step(name, seconds));
		}
		return steps;
	}
	saveCustom() {
		const name = this.dom.customName.value.trim();
		if (!name) { alert("請輸入自訂計時器名稱"); return; }
		const steps = this.collectEditorSteps();
		if (steps.length === 0) { alert("請至少新增一個步驟"); return; }
		const store = loadUserPresets();
		store[name] = steps.map(s => ({ name: s.name, seconds: s.seconds }));
		saveUserPresets(store);
		this.closeEditor();
		this.populatePresetSelect();
		this.dom.presetSelect.value = `custom::${name}`;
		this.applyPresetByValue(this.dom.presetSelect.value);
	}
	deleteCurrentCustom() {
		const val = this.dom.presetSelect.value;
		if (!val.startsWith("custom::")) { alert("目前選擇的不是自訂預設"); return; }
		const name = val.slice("custom::".length);
		const store = loadUserPresets();
		if (!(name in store)) { alert("找不到此自訂項目"); return; }
		if (!confirm(`確定刪除自訂「${name}」？`)) return;
		delete store[name];
		saveUserPresets(store);
		this.closeEditor();
		this.populatePresetSelect();
	}
}

// 工具：格式化秒數
function formatSeconds(total) {
	const m = Math.floor(total / 60);
	const s = Math.floor(total % 60);
	return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// 中文語音時間格式
function formatZhDuration(seconds) {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	if (m > 0 && s > 0) return `${m}分${s}`;
	if (m > 0) return `${m}分`;
	return `${s}`;
}
function formatZhRemaining(seconds) {
	return `${formatZhDuration(seconds)}`;
}

// 簡易語言偵測（中文→zh-TW，其餘→en-US）
function detectLang(text) {
	const t = String(text || "");
	if (/[\u4E00-\u9FFF]/.test(t)) return "zh-TW";
	return "en-US";
}

// 自訂預設儲存
const LS_KEY = "Times.userPresets.v1";
function loadUserPresets() {
	try {
		const raw = localStorage.getItem(LS_KEY);
		if (!raw) return {};
		const obj = JSON.parse(raw);
		return (obj && typeof obj === "object") ? obj : {};
	} catch {
		return {};
	}
}
function saveUserPresets(obj) {
	try {
		localStorage.setItem(LS_KEY, JSON.stringify(obj));
	} catch { }
}

// 啟動
window.addEventListener("DOMContentLoaded", async () => {
	if (!document.getElementById("appRoot")) return;
	const themeMeta = await loadThemesMetadata();
	const controller = new UIController();
	await controller.initialize(themeMeta);
});

// 小工具：sleep
function sleep(ms) {
	return new Promise(r => setTimeout(r, ms));
}

async function loadThemesMetadata() {
	const fallback = normalizeThemeMetadata(DEFAULT_THEME_CONFIG);
	try {
		const res = await fetch("./data/themes.json", { cache: "no-store" });
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const data = await res.json();
		return normalizeThemeMetadata(data, fallback);
	} catch (err) {
		console.error("載入 themes.json 失敗：", err);
		return fallback;
	}
}

async function loadThemePresets(theme, fallbackMap = FALLBACK_PRESET_MAP) {
	if (!theme) return { ...fallbackMap };
	if (Array.isArray(theme.presets) && theme.presets.length) {
		const inline = normalizePresetEntries(theme.presets);
		if (Object.keys(inline).length) return inline;
	}
	const filePath = typeof theme.file === "string" && theme.file.trim() ? theme.file.trim() : "";
	if (filePath) {
		try {
			const res = await fetch(`./data/${filePath}`, { cache: "no-store" });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();
			const normalized = normalizeBuiltinPresetData(data, theme.fallback ? fallbackMap : {});
			if (Object.keys(normalized).length) return normalized;
		} catch (err) {
			console.error(`載入主題檔案 ${filePath} 失敗：`, err);
		}
	}
	return { ...fallbackMap };
}

function normalizeThemeMetadata(raw, fallbackConfig = DEFAULT_THEME_CONFIG) {
	let source = [];
	let defaultThemeId = "";
	if (raw && typeof raw === "object") {
		if (Array.isArray(raw.themes)) source = raw.themes;
		if (raw.defaultThemeId) defaultThemeId = String(raw.defaultThemeId).trim();
	}
	if (!Array.isArray(source) || !source.length) {
		source = fallbackConfig.themes || [];
		defaultThemeId = fallbackConfig.defaultThemeId || "";
	}
	const themes = [];
	source.forEach((item, idx) => {
		if (!item || typeof item !== "object") return;
		const id = String(item.id || `theme_${idx + 1}`).trim() || `theme_${idx + 1}`;
		const name = String(item.name || id).trim() || id;
		const description = item.description ? String(item.description) : "";
		const usage = item.usage ? String(item.usage) : "";
		const file = item.file ? String(item.file).trim() : "";
		const presets = Array.isArray(item.presets) ? item.presets : undefined;
		const fallback = !!item.fallback || !file;
		themes.push({ id, name, description, usage, file, presets, fallback });
	});
	if (!themes.length && fallbackConfig && Array.isArray(fallbackConfig.themes)) {
		fallbackConfig.themes.forEach((item, idx) => {
			const id = String(item.id || `theme_${idx + 1}`).trim() || `theme_${idx + 1}`;
			const name = String(item.name || id).trim() || id;
			const description = item.description ? String(item.description) : "";
			const usage = item.usage ? String(item.usage) : "";
			const file = item.file ? String(item.file).trim() : "";
			const presets = Array.isArray(item.presets) ? item.presets : undefined;
			const fallback = !!item.fallback || !file;
			themes.push({ id, name, description, usage, file, presets, fallback });
		});
	}
	let resolvedDefault = defaultThemeId;
	if (!resolvedDefault || !themes.some((t) => t.id === resolvedDefault)) {
		resolvedDefault = themes.length ? themes[0].id : "";
	}
	return { themes, defaultThemeId: resolvedDefault };
}

function normalizeBuiltinPresetData(raw, fallback = {}) {
	let normalized = {};
	if (Array.isArray(raw)) {
		normalized = normalizePresetEntries(raw);
	} else if (raw && typeof raw === "object") {
		const aggregated = [];
		Object.keys(raw).forEach((key) => {
			const value = raw[key];
			if (!Array.isArray(value)) return;
			value.forEach((entry) => {
				if (entry && typeof entry === "object" && Array.isArray(entry.steps)) {
					aggregated.push(entry);
				}
			});
		});
		if (aggregated.length) {
			normalized = normalizePresetEntries(aggregated);
		} else if (Array.isArray(raw.presets)) {
			normalized = normalizePresetEntries(raw.presets);
		} else {
			const entries = Object.entries(raw).map(([name, steps]) => ({ name, steps }));
			normalized = normalizePresetEntries(entries);
		}
	}
	if (!normalized || !Object.keys(normalized).length) {
		return { ...fallback };
	}
	return normalized;
}

function normalizePresetEntries(entries) {
	const result = {};
	(entries || []).forEach((entry) => {
		if (!entry || typeof entry !== "object") return;
		const name = String(entry.name || "").trim();
		if (!name) return;
		const steps = Array.isArray(entry.steps) ? entry.steps : [];
		const normalizedSteps = steps.map((step) => {
			const stepName = String(step && step.name ? step.name : "").trim();
			const seconds = Math.max(0, Math.floor(Number(step && step.seconds != null ? step.seconds : 0)));
			return stepName ? { name: stepName, seconds } : null;
		}).filter(Boolean);
		if (normalizedSteps.length) {
			result[name] = normalizedSteps;
		}
	});
	return result;
}

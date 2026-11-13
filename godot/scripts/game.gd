extends Node
## Singleton global (autoload "Game"): dados do jogo, controles, configurações e hardware.

const MAP_SIZE = 1800.0
const HALF = MAP_SIZE * 0.5
const GRID = 4.0                       # resolução do relevo (m)
const GRID_N = int(MAP_SIZE / GRID) + 1
const WATER_LEVEL = 0.0
const PORT = 7777

# Camadas de física
const L_WORLD = 1        # terreno, casas, árvores
const L_BODY = 2         # cápsulas dos soldados (colisão de movimento)
const L_HITBOX = 4       # hitboxes (cabeça/tronco/pernas) atingidas por balas
const L_LOOT = 8

# ---------------------------------------------------------------- armas
# vel = velocidade do projétil (m/s) → queda de bala realista
const WEAPONS = {
	"p9":     {"name": "Pistola P-9",       "ammo": "9mm", "dmg": 24.0, "rpm": 400.0, "mag": 15, "reload": 1.8, "vel": 360.0, "hip": 0.030, "ads": 0.010, "recoil": 0.012, "auto": false, "pellets": 1, "slot": 2, "scope": 1.0, "len": 0.25},
	"vespa":  {"name": "SMG Vespa",         "ammo": "9mm", "dmg": 22.0, "rpm": 820.0, "mag": 30, "reload": 2.1, "vel": 400.0, "hip": 0.028, "ads": 0.008, "recoil": 0.010, "auto": true,  "pellets": 1, "slot": 0, "scope": 1.0, "len": 0.6},
	"ar7":    {"name": "Fuzil AR-7",        "ammo": "556", "dmg": 41.0, "rpm": 700.0, "mag": 30, "reload": 2.3, "vel": 880.0, "hip": 0.030, "ads": 0.004, "recoil": 0.016, "auto": true,  "pellets": 1, "slot": 0, "scope": 1.0, "len": 0.95},
	"m12":    {"name": "Fuzil M-12",        "ammo": "762", "dmg": 47.0, "rpm": 600.0, "mag": 30, "reload": 2.6, "vel": 715.0, "hip": 0.034, "ads": 0.005, "recoil": 0.026, "auto": true,  "pellets": 1, "slot": 0, "scope": 1.0, "len": 0.95},
	"t12":    {"name": "Escopeta T12",      "ammo": "12g", "dmg": 24.0, "rpm": 70.0,  "mag": 5,  "reload": 3.0, "vel": 360.0, "hip": 0.060, "ads": 0.045, "recoil": 0.05,  "auto": false, "pellets": 9, "slot": 0, "scope": 1.0, "len": 1.0},
	"lince":  {"name": "DMR Lince",         "ammo": "762", "dmg": 58.0, "rpm": 300.0, "mag": 10, "reload": 2.8, "vel": 850.0, "hip": 0.040, "ads": 0.0015, "recoil": 0.030, "auto": false, "pellets": 1, "slot": 0, "scope": 4.0, "len": 1.1},
	"falcao": {"name": "Sniper Falcão",     "ammo": "762", "dmg": 79.0, "rpm": 42.0,  "mag": 5,  "reload": 3.2, "vel": 760.0, "hip": 0.050, "ads": 0.0006, "recoil": 0.06,  "auto": false, "pellets": 1, "slot": 0, "scope": 4.0, "len": 1.2},
	# exclusivas da caixa de suprimentos
	"trovao": {"name": "Sniper Trovão ★",   "ammo": "300", "dmg": 105.0, "rpm": 45.0, "mag": 5,  "reload": 3.5, "vel": 910.0, "hip": 0.050, "ads": 0.0004, "recoil": 0.07,  "auto": false, "pellets": 1, "slot": 0, "scope": 8.0, "len": 1.35},
	"m9":     {"name": "Metralhadora M-9 ★", "ammo": "556", "dmg": 40.0, "rpm": 900.0, "mag": 75, "reload": 4.5, "vel": 880.0, "hip": 0.035, "ads": 0.006, "recoil": 0.014, "auto": true,  "pellets": 1, "slot": 0, "scope": 1.0, "len": 1.1},
}
const AMMO = {"9mm": 30, "556": 30, "762": 30, "12g": 10, "300": 10}
const AMMO_NAME = {"9mm": "Munição 9mm", "556": "Munição 5.56", "762": "Munição 7.62", "12g": "Cartucho 12", "300": "Munição .300"}

# cura: tempo de uso, hp alvo/limite, boost
const HEALS = {
	"bandage": {"name": "Bandagem",              "time": 4.0, "add": 10.0, "cap": 75.0,  "boost": 0.0},
	"firstaid": {"name": "Kit de primeiros socorros", "time": 6.0, "add": 75.0, "cap": 75.0, "boost": 0.0},
	"medkit":  {"name": "Kit médico",            "time": 8.0, "add": 100.0, "cap": 100.0, "boost": 0.0},
	"drink":   {"name": "Energético",            "time": 4.0, "add": 0.0, "cap": 0.0, "boost": 40.0},
	"pills":   {"name": "Analgésico",            "time": 6.0, "add": 0.0, "cap": 0.0, "boost": 60.0},
}
const ARMOR_RED = [0.0, 0.30, 0.40, 0.55]
const HELMET_RED = [0.0, 0.30, 0.40, 0.55]
const ATTACH = {"scope2": "Mira 2x", "scope4": "Mira 4x", "scope8": "Mira 8x", "extmag": "Carregador estendido", "comp": "Compensador"}

# tabela de loot comum (peso)
const LOOT_TABLE = [
	["p9", 9], ["vespa", 8], ["ar7", 7], ["m12", 5], ["t12", 6], ["lince", 3], ["falcao", 2],
	["ammo:9mm", 9], ["ammo:556", 10], ["ammo:762", 9], ["ammo:12g", 5],
	["bandage", 10], ["firstaid", 5], ["medkit", 1], ["drink", 5], ["pills", 3],
	["vest1", 5], ["vest2", 3], ["vest3", 1], ["helmet1", 5], ["helmet2", 3], ["helmet3", 1],
	["pack1", 4], ["pack2", 2], ["pack3", 1], ["scope2", 3], ["scope4", 2], ["scope8", 1], ["extmag", 3], ["comp", 3],
]

const BOT_NAMES = ["Lobo", "Faísca", "Tornado", "Sombra", "Raposa", "Trovão", "Gavião", "Pantera", "Cobra", "Fantasma", "Titã", "Vulcão", "Coruja", "Neblina", "Orca", "Jaguar", "Falcão", "Ciclone", "Granito", "Pirata", "Cometa", "Escorpião", "Lince", "Tubarão", "Bisão", "Corvo", "Ninja", "Vândalo", "Atlas", "Bala", "Turbo", "Rocha", "Zebra", "Mamba", "Fênix", "Dragão", "Urso", "Cacto", "Radar", "Sabre", "Tigre", "Nômade", "Relâmpago", "Vento", "Âncora", "Ferro", "Sílex", "Garra", "Brasa", "Cobalto"]

# ---------------------------------------------------------------- configurações
var settings = {"tier": -1, "sens": 1.0, "volume": 0.7, "fov": 80.0, "bots": 39, "name": "", "show_fps": true, "dyn_res": true, "ip": "127.0.0.1"}
var hw = {}
var rng = RandomNumberGenerator.new()

func _ready() -> void:
	rng.randomize()
	_setup_input()
	_load_settings()
	hw = detect_hardware()

func item_name(t: String) -> String:
	if WEAPONS.has(t): return WEAPONS[t].name
	if t.begins_with("ammo:"): return AMMO_NAME.get(t.substr(5), t)
	if HEALS.has(t): return HEALS[t].name
	if ATTACH.has(t): return ATTACH[t]
	if t.begins_with("vest"): return "Colete Nv" + t.substr(4)
	if t.begins_with("helmet"): return "Capacete Nv" + t.substr(6)
	if t.begins_with("pack"): return "Mochila Nv" + t.substr(4)
	return t

func roll_loot(r: RandomNumberGenerator) -> String:
	var total = 0
	for e in LOOT_TABLE: total += int(e[1])
	var x = r.randi_range(1, total)
	for e in LOOT_TABLE:
		x -= int(e[1])
		if x <= 0: return String(e[0])
	return "bandage"

# ---------------------------------------------------------------- controles
func _setup_input() -> void:
	var keys = {
		"move_forward": [KEY_W], "move_back": [KEY_S], "move_left": [KEY_A], "move_right": [KEY_D],
		"jump": [KEY_SPACE], "crouch": [KEY_C], "prone": [KEY_Z], "sprint": [KEY_SHIFT], "walk": [KEY_CTRL],
		"lean_left": [KEY_Q], "lean_right": [KEY_E], "interact": [KEY_F], "reload": [KEY_R],
		"slot1": [KEY_1], "slot2": [KEY_2], "slot3": [KEY_3], "holster": [KEY_X],
		"use_bandage": [KEY_4], "use_firstaid": [KEY_5], "use_medkit": [KEY_6], "use_drink": [KEY_7], "use_pills": [KEY_8],
		"toggle_view": [KEY_V], "freelook": [KEY_ALT], "map": [KEY_M], "inventory": [KEY_TAB], "firemode": [KEY_B], "menu": [KEY_ESCAPE],
	}
	for a in keys:
		if not InputMap.has_action(a): InputMap.add_action(a)
		for k in keys[a]:
			var ev = InputEventKey.new(); ev.physical_keycode = k
			InputMap.action_add_event(a, ev)
	for pair in [["fire", MOUSE_BUTTON_LEFT], ["aim", MOUSE_BUTTON_RIGHT]]:
		if not InputMap.has_action(pair[0]): InputMap.add_action(pair[0])
		var mb = InputEventMouseButton.new(); mb.button_index = pair[1]
		InputMap.action_add_event(pair[0], mb)

func _load_settings() -> void:
	var cf = ConfigFile.new()
	if cf.load("user://settings.cfg") == OK:
		for k in settings.keys(): settings[k] = cf.get_value("s", k, settings[k])

func save_settings() -> void:
	var cf = ConfigFile.new()
	for k in settings.keys(): cf.set_value("s", k, settings[k])
	cf.save("user://settings.cfg")

# ---------------------------------------------------------------- hardware
func detect_hardware() -> Dictionary:
	var info = {
		"gpu": RenderingServer.get_video_adapter_name(),
		"vendor": RenderingServer.get_video_adapter_vendor(),
		"cores": OS.get_processor_count(),
		"mem_gb": 0.0,
		"compat": RenderingServer.get_rendering_device() == null,   # OpenGL (PCs antigos sem Vulkan)
		"screen": DisplayServer.screen_get_size(),
	}
	var mi = OS.get_memory_info()
	if mi.has("physical") and int(mi["physical"]) > 0: info["mem_gb"] = float(mi["physical"]) / 1073741824.0
	info["score"] = score_gpu(String(info["gpu"]))
	var t: int = info["score"]
	if info["cores"] <= 2: t = mini(t, 1)
	elif info["cores"] <= 4: t = mini(t, 3)
	if info["mem_gb"] > 0.0 and info["mem_gb"] <= 4.5: t = mini(t, 1)
	elif info["mem_gb"] > 0.0 and info["mem_gb"] <= 8.5: t = mini(t, 3)
	if info["compat"]: t = mini(t, 1)
	if t == 5 and info["cores"] < 6: t = 4
	info["tier"] = clampi(t, 0, 5)
	return info

func score_gpu(name: String) -> int:
	var g = name.to_lower()
	var tests = [
		[0, "swiftshader|llvmpipe|softpipe|software|basic render|gma|mali-[34]|powervr|videocore"],
		[5, "rtx\\s?50\\d0|rtx\\s?40[6-9]0|rtx\\s?30[7-9]0|rx\\s?7[89]00|rx\\s?9070|rx\\s?6[89]00|m\\d (max|ultra)"],
		[4, "rtx|rx\\s?[67]\\d{3}|arc a7|arc b|apple m[2-9]"],
		[3, "gtx\\s?16|gtx\\s?10[6-8]0|rx\\s?5[5-7]00|rx\\s?[45][78]0|vega (56|64)|arc|apple m1"],
		[2, "gtx|rx\\s?[45]\\d\\d|radeon\\(tm\\) graphics|radeon graphics|vega|iris xe|mx\\s?[1-5]\\d0"],
		[1, "uhd|iris|hd graphics (4\\d\\d|5\\d\\d|6\\d\\d|4[4-6]00|5\\d00|6000)|geforce|radeon|adreno|mali"],
		[0, "hd graphics"],
	]
	for t in tests:
		var re = RegEx.new(); re.compile(t[1])
		if re.search(g): return t[0]
	return 1

func tier_name(t: int) -> String:
	return ["Batata (PC muito fraco)", "Baixo", "Médio", "Alto", "Ultra", "Extremo (GI + até 8K)"][clampi(t, 0, 5)]

func current_tier() -> int:
	return hw.get("tier", 1) if int(settings["tier"]) < 0 else int(settings["tier"])

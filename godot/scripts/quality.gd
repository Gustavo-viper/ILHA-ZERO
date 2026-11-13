extends Node
## Níveis gráficos + ajuste automático pelo FPS (resolução dinâmica e troca de nível).

# view = distância de visão; grass = [raio do capim, densidade]; veg = fração de árvores
const TIERS := [
	{"scale": 0.55, "min": 0.4, "max": 0.65, "shadows": 0, "shadow_dist": 0.0, "view": 380.0, "grass": [0.0, 0.0], "veg": 0.35, "ssao": false, "ssil": false, "ssr": false, "sdfgi": false, "glow": false, "volfog": false, "msaa": 0, "taa": false, "target": 30.0},
	{"scale": 0.75, "min": 0.5, "max": 0.85, "shadows": 1, "shadow_dist": 60.0, "view": 600.0, "grass": [22.0, 0.45], "veg": 0.55, "ssao": false, "ssil": false, "ssr": false, "sdfgi": false, "glow": false, "volfog": false, "msaa": 0, "taa": false, "target": 40.0},
	{"scale": 0.9, "min": 0.6, "max": 1.0, "shadows": 2, "shadow_dist": 120.0, "view": 1000.0, "grass": [36.0, 0.7], "veg": 0.8, "ssao": true, "ssil": false, "ssr": false, "sdfgi": false, "glow": true, "volfog": false, "msaa": 0, "taa": false, "target": 55.0},
	{"scale": 1.0, "min": 0.7, "max": 1.0, "shadows": 3, "shadow_dist": 200.0, "view": 1500.0, "grass": [50.0, 0.9], "veg": 1.0, "ssao": true, "ssil": false, "ssr": false, "sdfgi": false, "glow": true, "volfog": true, "msaa": 0, "taa": true, "target": 58.0},
	{"scale": 1.0, "min": 0.75, "max": 1.25, "shadows": 3, "shadow_dist": 300.0, "view": 2200.0, "grass": [65.0, 1.0], "veg": 1.0, "ssao": true, "ssil": true, "ssr": true, "sdfgi": true, "glow": true, "volfog": true, "msaa": 2, "taa": true, "target": 58.0},
	{"scale": 1.5, "min": 0.85, "max": 2.0, "shadows": 3, "shadow_dist": 400.0, "view": 2600.0, "grass": [80.0, 1.0], "veg": 1.0, "ssao": true, "ssil": true, "ssr": true, "sdfgi": true, "glow": true, "volfog": true, "msaa": 4, "taa": true, "target": 58.0},
]

var env: Environment
var sun: DirectionalLight3D
var world: Node
var tier := 1
var scale := 1.0
var auto := true
var dyn_res := true
var fps := 60.0
var _acc := 0.0
var _frames := 0
var _low := 0
var _high := 0
var _grace := 3
var failed_up := {}
var compat := false

signal tier_changed(t: int, reason: String)

func setup(e: Environment, s: DirectionalLight3D, w: Node) -> void:
	env = e; sun = s; world = w
	compat = Game.hw.get("compat", false)
	auto = int(Game.settings["tier"]) < 0
	dyn_res = bool(Game.settings["dyn_res"])
	apply(Game.current_tier())

func apply(t: int) -> void:
	tier = clampi(t, 0, 5)
	var T: Dictionary = TIERS[tier]
	var vp := get_viewport()
	scale = clampf(float(T.scale), float(T.min), max_scale())
	if tier == 5: scale = max_scale()
	_set_scale(scale)
	var m := int(T.msaa)
	vp.msaa_3d = Viewport.MSAA_4X if m >= 4 else (Viewport.MSAA_2X if m >= 2 else Viewport.MSAA_DISABLED)
	vp.use_taa = bool(T.taa) and not compat
	vp.screen_space_aa = Viewport.SCREEN_SPACE_AA_FXAA if not bool(T.taa) else Viewport.SCREEN_SPACE_AA_DISABLED
	# sombras do sol
	sun.shadow_enabled = int(T.shadows) > 0
	sun.directional_shadow_mode = [DirectionalLight3D.SHADOW_ORTHOGONAL, DirectionalLight3D.SHADOW_ORTHOGONAL, DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS, DirectionalLight3D.SHADOW_PARALLEL_4_SPLITS][int(T.shadows)]
	sun.directional_shadow_max_distance = float(T.shadow_dist)
	# efeitos de tela (só no renderizador Vulkan/Forward+)
	env.ssao_enabled = bool(T.ssao) and not compat
	env.ssil_enabled = bool(T.ssil) and not compat
	env.ssr_enabled = bool(T.ssr) and not compat
	env.sdfgi_enabled = bool(T.sdfgi) and not compat
	env.glow_enabled = bool(T.glow)
	env.volumetric_fog_enabled = bool(T.volfog) and not compat
	if env.sdfgi_enabled:
		env.sdfgi_cascades = 6 if tier == 5 else 4
		env.sdfgi_use_occlusion = tier == 5
		RenderingServer.environment_set_sdfgi_ray_count(RenderingServer.ENV_SDFGI_RAY_COUNT_96 if tier == 5 else RenderingServer.ENV_SDFGI_RAY_COUNT_32)
	if env.ssr_enabled: env.ssr_max_steps = 96 if tier == 5 else 48
	# distância de visão / neblina
	var cam := vp.get_camera_3d()
	if cam: cam.far = float(T.view) + 300.0
	env.fog_enabled = true
	env.fog_density = 0.0028 if tier == 0 else (0.0016 if tier == 1 else 0.0008)
	if world and world.has_method("apply_quality"): world.apply_quality(T, tier)
	_grace = 3; _low = 0; _high = 0

func max_scale() -> float:
	var T: Dictionary = TIERS[tier]
	if tier == 5:
		# supersampling: renderiza acima da tela, até 7680x4320 (8K) se a GPU aguentar
		var w := float(get_viewport().get_visible_rect().size.x)
		return clampf(7680.0 / maxf(w, 1.0), 1.0, 2.0)
	return float(T.max)

func _set_scale(s: float) -> void:
	scale = s
	var vp := get_viewport()
	if s < 0.999 and not compat:
		vp.scaling_3d_mode = Viewport.SCALING_3D_MODE_FSR2 if tier >= 2 else Viewport.SCALING_3D_MODE_FSR
	else:
		vp.scaling_3d_mode = Viewport.SCALING_3D_MODE_BILINEAR
	vp.scaling_3d_scale = s

func _process(dt: float) -> void:
	if env == null: return
	_frames += 1; _acc += dt
	if _acc < 1.0: return
	fps = _frames / _acc; _frames = 0; _acc = 0.0
	if _grace > 0:
		_grace -= 1
		return
	var T: Dictionary = TIERS[tier]
	var target := float(T.target)
	if dyn_res:
		if fps < target - 4.0 and scale > float(T.min): _set_scale(maxf(float(T.min), scale * (0.82 if fps < target * 0.6 else 0.92)))
		elif fps > target + 2.0 and scale < max_scale(): _set_scale(minf(max_scale(), scale * 1.04))
	if not auto: return
	if fps < target * 0.7 and (scale <= float(T.min) + 0.001 or not dyn_res): _low += 1
	else: _low = maxi(0, _low - 1)
	if _low >= 4 and tier > 0:
		failed_up[tier] = true
		apply(tier - 1); tier_changed.emit(tier, "down"); return
	if fps >= 57.0 and scale >= max_scale() - 0.001: _high += 1
	else: _high = 0
	if _high >= 8 and tier < 5 and not failed_up.has(tier + 1):
		apply(tier + 1); tier_changed.emit(tier, "up")

func render_size() -> Vector2i:
	var s := get_viewport().get_visible_rect().size
	return Vector2i(int(s.x * scale), int(s.y * scale))

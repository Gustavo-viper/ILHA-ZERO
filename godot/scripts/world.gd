extends Node3D
## Mundo procedural determinístico (mesma semente = mesma ilha em todos os jogadores da partida).

const TOWN_NAMES := ["Porto Alto", "Vila Serena", "Pedra Negra", "Campo Verde", "Farol Sul", "Usina Velha", "Mirante", "Baía Azul", "Colina Seca", "Vale Fundo"]
const SECTORS := 6

var seed_value := 1
var h := PackedFloat32Array()       # alturas na grade (GRID_N x GRID_N)
var grass_mask := PackedByteArray() # 0 = sem capim
var towns: Array = []               # {pos: Vector2, y, r, name}
var houses: Array = []              # {x,z,w,d,y,floors,top}
var loot_spots: Array = []          # Vector3
var noise := FastNoiseLite.new()
var noise2 := FastNoiseLite.new()
var rng := RandomNumberGenerator.new()

var env: Environment
var sun: DirectionalLight3D
var mats := {}
var tree_mms: Array = []            # [MultiMeshInstance3D, total]
var grass_root: Node3D
var grass_tiles := {}
var grass_cfg := [0.0, 0.0]
var grass_mesh: ArrayMesh
var grass_mat: ShaderMaterial
const GRASS_TILE := 16.0

func generate(seed_in: int) -> void:
	seed_value = seed_in
	rng.seed = seed_in
	noise.seed = seed_in; noise.frequency = 1.0 / 330.0; noise.fractal_octaves = 5; noise.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	noise2.seed = seed_in * 7 + 3; noise2.frequency = 1.0 / 260.0; noise2.fractal_octaves = 3
	_make_materials()
	_heights()
	_towns()
	_environment()
	_terrain_mesh()
	_terrain_collision()
	_water()
	_buildings()
	_props()
	_vegetation()
	_grass_setup()

# ---------------------------------------------------------------- relevo
func _heights() -> void:
	var N := Game.GRID_N
	h.resize(N * N)
	for j in N:
		for i in N:
			var x := i * Game.GRID - Game.HALF
			var z := j * Game.GRID - Game.HALF
			var d := Vector2(x, z).length() / Game.HALF + noise2.get_noise_2d(x, z) * 0.18
			var mask := 1.0 - smoothstep(0.72, 1.0, d)
			var n := noise.get_noise_2d(x, z) * 0.5 + 0.5
			var ridge := 1.0 - absf(noise2.get_noise_2d(x * 0.5 + 900.0, z * 0.5 - 400.0))
			h[j * N + i] = pow(n, 1.6) * 60.0 * mask + ridge * ridge * 20.0 * mask + (mask * 14.0 - 9.0)

func height_at(x: float, z: float) -> float:
	var N := Game.GRID_N
	var fx := clampf((x + Game.HALF) / Game.GRID, 0.0, N - 1.001)
	var fz := clampf((z + Game.HALF) / Game.GRID, 0.0, N - 1.001)
	var i := int(fx); var j := int(fz)
	var u := fx - i; var v := fz - j
	var a := h[j * N + i]; var b := h[j * N + i + 1]; var c := h[(j + 1) * N + i]; var d := h[(j + 1) * N + i + 1]
	return lerpf(lerpf(a, b, u), lerpf(c, d, u), v)

func slope_at(x: float, z: float) -> float:
	return absf(height_at(x + 3, z) - height_at(x - 3, z)) / 6.0 + absf(height_at(x, z + 3) - height_at(x, z - 3)) / 6.0

func random_land_point(r: RandomNumberGenerator, inner := 0.7) -> Vector3:
	for k in 200:
		var x := r.randf_range(-1, 1) * Game.HALF * inner
		var z := r.randf_range(-1, 1) * Game.HALF * inner
		var y := height_at(x, z)
		if y > 2.5: return Vector3(x, y, z)
	return Vector3(0, height_at(0, 0), 0)

func _flatten(c: Vector2, r: float, y: float) -> void:
	var N := Game.GRID_N
	var R := r + 40.0
	var i0 := maxi(0, int((c.x - R + Game.HALF) / Game.GRID)); var i1 := mini(N - 1, int((c.x + R + Game.HALF) / Game.GRID) + 1)
	var j0 := maxi(0, int((c.y - R + Game.HALF) / Game.GRID)); var j1 := mini(N - 1, int((c.y + R + Game.HALF) / Game.GRID) + 1)
	for j in range(j0, j1 + 1):
		for i in range(i0, i1 + 1):
			var p := Vector2(i * Game.GRID - Game.HALF, j * Game.GRID - Game.HALF)
			var w := 1.0 - smoothstep(r, R, p.distance_to(c))
			h[j * N + i] = lerpf(h[j * N + i], y, w)

func _towns() -> void:
	var tries := 0
	while towns.size() < 8 and tries < 600:
		tries += 1
		var p := Vector2(rng.randf_range(-1, 1), rng.randf_range(-1, 1)) * Game.HALF * 0.66
		var y := height_at(p.x, p.y)
		if y < 3.0 or y > 42.0: continue
		var ok := true
		for t in towns:
			if t.pos.distance_to(p) < 280.0: ok = false
		if not ok: continue
		var nt := {"pos": p, "y": maxf(3.0, y), "r": rng.randf_range(55.0, 80.0), "name": TOWN_NAMES[towns.size() % TOWN_NAMES.size()]}
		towns.append(nt)
		_flatten(p, float(nt.r), float(nt.y))

func near_town(x: float, z: float, pad: float) -> bool:
	for t in towns:
		if t.pos.distance_to(Vector2(x, z)) < t.r + pad: return true
	return false

# ---------------------------------------------------------------- materiais
func _noise_tex(freq: float, seed_n: int, size := 512) -> NoiseTexture2D:
	var nt := NoiseTexture2D.new()
	var fn := FastNoiseLite.new(); fn.seed = seed_n; fn.frequency = freq; fn.fractal_octaves = 5
	nt.noise = fn; nt.seamless = true; nt.width = size; nt.height = size; nt.generate_mipmaps = true
	return nt

func _mat(color: Color, tex: Texture2D, triplanar_scale: Vector3, rough := 0.9, metal := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.vertex_color_use_as_albedo = true
	if tex:
		m.albedo_texture = tex
		m.uv1_triplanar = true
		m.uv1_world_triplanar = true
		m.uv1_scale = triplanar_scale
	m.roughness = rough; m.metallic = metal
	m.cull_mode = BaseMaterial3D.CULL_DISABLED   # faces das casas visíveis de qualquer lado
	return m

func _make_materials() -> void:
	var n_fine := _noise_tex(0.05, 11)
	var n_soft := _noise_tex(0.02, 23)
	mats["wood"] = _mat(Color(1, 1, 1), n_fine, Vector3(0.6, 6.0, 0.6), 0.92)          # tábuas: ruído esticado
	mats["plaster"] = _mat(Color(1, 1, 1), n_soft, Vector3(0.25, 0.25, 0.25), 0.95)
	mats["roof_tile"] = _mat(Color(1, 1, 1), n_fine, Vector3(3.0, 0.5, 3.0), 0.8)
	mats["roof_metal"] = _mat(Color(1, 1, 1), n_fine, Vector3(6.0, 0.3, 0.3), 0.5, 0.45)
	mats["metal"] = _mat(Color(1, 1, 1), n_fine, Vector3(4.0, 0.4, 0.4), 0.55, 0.4)
	mats["bark"] = _mat(Color(0.42, 0.33, 0.25), n_fine, Vector3(3.0, 0.4, 3.0), 1.0)
	mats["foliage"] = _mat(Color(0.32, 0.42, 0.22), n_fine, Vector3(0.6, 0.6, 0.6), 0.9)
	mats["pine"] = _mat(Color(0.20, 0.30, 0.17), n_fine, Vector3(0.7, 0.7, 0.7), 0.9)
	mats["rock"] = _mat(Color(0.55, 0.54, 0.51), n_soft, Vector3(0.6, 0.6, 0.6), 0.95)
	mats["bush"] = _mat(Color(0.36, 0.44, 0.22), n_fine, Vector3(0.8, 0.8, 0.8), 0.95)
	var tm := ShaderMaterial.new(); tm.shader = load("res://shaders/terrain.gdshader")
	tm.set_shader_parameter("noise_a", _noise_tex(0.06, 37))
	tm.set_shader_parameter("noise_b", _noise_tex(0.03, 41))
	mats["terrain"] = tm
	grass_mat = ShaderMaterial.new(); grass_mat.shader = load("res://shaders/grass.gdshader")

# ---------------------------------------------------------------- ambiente
func _environment() -> void:
	env = Environment.new()
	env.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var sm := ShaderMaterial.new(); sm.shader = load("res://shaders/sky.gdshader")
	sky.sky_material = sm
	sky.radiance_size = Sky.RADIANCE_SIZE_256
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_sky_contribution = 0.85
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 1.0
	env.tonemap_white = 6.0
	env.fog_enabled = true
	env.fog_light_color = Color(0.70, 0.78, 0.86)
	env.fog_density = 0.0008
	env.fog_aerial_perspective = 0.6
	env.fog_sky_affect = 0.15
	env.volumetric_fog_density = 0.004
	env.volumetric_fog_albedo = Color(0.85, 0.88, 0.92)
	env.volumetric_fog_length = 120.0
	env.glow_intensity = 0.35; env.glow_bloom = 0.04; env.glow_hdr_threshold = 1.1
	env.ssao_radius = 1.2; env.ssao_intensity = 1.6
	env.adjustment_enabled = true
	env.adjustment_contrast = 1.08; env.adjustment_saturation = 1.08; env.adjustment_brightness = 1.0
	var we := WorldEnvironment.new(); we.environment = env; add_child(we)
	sun = DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-42, -35, 0)
	sun.light_energy = 1.25
	sun.light_color = Color(1.0, 0.95, 0.86)
	sun.shadow_enabled = true
	sun.shadow_blur = 1.5
	sun.directional_shadow_blend_splits = true
	add_child(sun)

# ---------------------------------------------------------------- terreno (malha em blocos + colisão)
func _splat_at(x: float, z: float, y: float) -> Color:
	var sl := slope_at(x, z)
	var sand := 1.0 if y < 2.4 else clampf(3.4 - y, 0.0, 1.0)
	var rock := clampf((sl - 0.42) * 3.0, 0.0, 1.0) + (clampf((y - 60.0) / 8.0, 0.0, 1.0))
	var nz := noise2.get_noise_2d(x * 6.0, z * 6.0) * 0.5 + 0.5
	var dirt := clampf((nz - 0.66) * 3.0, 0.0, 1.0)
	for t in towns:
		var dd: float = t.pos.distance_to(Vector2(x, z))
		if dd < t.r * 1.05: dirt = maxf(dirt, 0.6 * (1.0 - dd / (t.r * 1.05)) + (0.35 if noise.get_noise_2d(x * 30.0, z * 30.0) > 0.1 else 0.0))
	rock = clampf(rock, 0, 1); sand = clampf(sand, 0, 1); dirt = clampf(dirt, 0, 1) * (1.0 - rock) * (1.0 - sand)
	return Color(maxf(0.0, 1.0 - rock - sand - dirt), dirt, rock, sand)

func _terrain_mesh() -> void:
	var N := Game.GRID_N
	var cells := N - 1
	var per := int(ceil(float(cells) / SECTORS))
	for sj in SECTORS:
		for si in SECTORS:
			var i0 := si * per; var j0 := sj * per
			var i1 := mini(cells, i0 + per); var j1 := mini(cells, j0 + per)
			var w := i1 - i0 + 1; var d := j1 - j0 + 1
			var verts := PackedVector3Array(); var norms := PackedVector3Array(); var cols := PackedColorArray(); var idx := PackedInt32Array()
			verts.resize(w * d); norms.resize(w * d); cols.resize(w * d)
			for j in d:
				for i in w:
					var gi := i0 + i; var gj := j0 + j
					var x := gi * Game.GRID - Game.HALF; var z := gj * Game.GRID - Game.HALF
					var y := h[gj * N + gi]
					var k := j * w + i
					verts[k] = Vector3(x, y, z)
					var hl := h[gj * N + maxi(0, gi - 1)]; var hr := h[gj * N + mini(N - 1, gi + 1)]
					var hd := h[maxi(0, gj - 1) * N + gi]; var hu := h[mini(N - 1, gj + 1) * N + gi]
					norms[k] = Vector3(hl - hr, 2.0 * Game.GRID, hd - hu).normalized()
					cols[k] = _splat_at(x, z, y)
			for j in d - 1:
				for i in w - 1:
					var a := j * w + i
					idx.append_array([a, a + 1, a + w, a + 1, a + w + 1, a + w])
			var arr := []; arr.resize(Mesh.ARRAY_MAX)
			arr[Mesh.ARRAY_VERTEX] = verts; arr[Mesh.ARRAY_NORMAL] = norms; arr[Mesh.ARRAY_COLOR] = cols; arr[Mesh.ARRAY_INDEX] = idx
			var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
			am.surface_set_material(0, mats["terrain"])
			var mi := MeshInstance3D.new(); mi.mesh = am
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
			add_child(mi)

func _terrain_collision() -> void:
	# HeightMapShape3D com escala uniforme (espaçamento = GRID, alturas divididas pela escala)
	var N := Game.GRID_N
	var shape := HeightMapShape3D.new()
	shape.map_width = N; shape.map_depth = N
	var data := PackedFloat32Array(); data.resize(N * N)
	for k in N * N: data[k] = h[k] / Game.GRID
	shape.map_data = data
	var body := StaticBody3D.new(); body.collision_layer = Game.L_WORLD; body.collision_mask = 0
	var cs := CollisionShape3D.new(); cs.shape = shape
	cs.scale = Vector3.ONE * Game.GRID
	body.add_child(cs); add_child(body)

func _water() -> void:
	var pm := PlaneMesh.new(); pm.size = Vector2(Game.MAP_SIZE * 4.0, Game.MAP_SIZE * 4.0)
	var m := ShaderMaterial.new(); m.shader = load("res://shaders/water.gdshader")
	pm.material = m
	var mi := MeshInstance3D.new(); mi.mesh = pm; mi.position.y = Game.WATER_LEVEL
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)

# ---------------------------------------------------------------- construções
# Cada cidade vira poucas malhas (uma por material) + um corpo estático com caixas de colisão.
class Builder:
	var st := {}
	var body: StaticBody3D
	func _init(b: StaticBody3D) -> void: body = b
	func get_tool(m: String) -> SurfaceTool:
		if not st.has(m):
			var s := SurfaceTool.new(); s.begin(Mesh.PRIMITIVE_TRIANGLES); st[m] = s
		return st[m]
	func quad(m: String, p: Array, n: Vector3, c: Color) -> void:
		var s := get_tool(m)
		for k in [0, 1, 2, 0, 2, 3]:
			s.set_color(c); s.set_normal(n); s.set_uv(Vector2(0, 0)); s.add_vertex(p[k])
	func tri(m: String, a: Vector3, b: Vector3, cc: Vector3, c: Color, outward: Vector3) -> void:
		var n := (b - a).cross(cc - a).normalized()
		if n.dot(outward) < 0.0:
			var t := b; b = cc; cc = t; n = -n
		var s := get_tool(m)
		for v in [a, b, cc]:
			s.set_color(c); s.set_normal(n); s.set_uv(Vector2(0, 0)); s.add_vertex(v)
	func box(m: String, a: Vector3, b: Vector3, c: Color, collide := true) -> void:
		var x0 := minf(a.x, b.x); var x1 := maxf(a.x, b.x); var y0 := minf(a.y, b.y); var y1 := maxf(a.y, b.y); var z0 := minf(a.z, b.z); var z1 := maxf(a.z, b.z)
		quad(m, [Vector3(x1, y0, z0), Vector3(x1, y1, z0), Vector3(x1, y1, z1), Vector3(x1, y0, z1)], Vector3.RIGHT, c)
		quad(m, [Vector3(x0, y0, z1), Vector3(x0, y1, z1), Vector3(x0, y1, z0), Vector3(x0, y0, z0)], Vector3.LEFT, c)
		quad(m, [Vector3(x0, y1, z0), Vector3(x0, y1, z1), Vector3(x1, y1, z1), Vector3(x1, y1, z0)], Vector3.UP, c)
		quad(m, [Vector3(x0, y0, z1), Vector3(x0, y0, z0), Vector3(x1, y0, z0), Vector3(x1, y0, z1)], Vector3.DOWN, c)
		quad(m, [Vector3(x1, y0, z1), Vector3(x1, y1, z1), Vector3(x0, y1, z1), Vector3(x0, y0, z1)], Vector3.BACK, c)
		quad(m, [Vector3(x0, y0, z0), Vector3(x0, y1, z0), Vector3(x1, y1, z0), Vector3(x1, y0, z0)], Vector3.FORWARD, c)
		if collide:
			var cs := CollisionShape3D.new(); var bs := BoxShape3D.new()
			bs.size = Vector3(x1 - x0, y1 - y0, z1 - z0); cs.shape = bs
			cs.position = Vector3((x0 + x1) * 0.5, (y0 + y1) * 0.5, (z0 + z1) * 0.5)
			body.add_child(cs)
	func commit(parent: Node3D, mats: Dictionary) -> void:
		for m in st:
			var s: SurfaceTool = st[m]
			var mi := MeshInstance3D.new(); mi.mesh = s.commit()
			mi.material_override = mats[m]
			parent.add_child(mi)

func _buildings() -> void:
	var wood_cols := [Color("#7fa3a3"), Color("#7f9a6a"), Color("#b7a88a"), Color("#8fa2b8"), Color("#9b6f55"), Color("#a8a49a")]
	var plaster_cols := [Color("#e8e2d4"), Color("#c9c4b8"), Color("#d8c8a8"), Color("#b9b2a6")]
	for t in towns:
		var body := StaticBody3D.new(); body.collision_layer = Game.L_WORLD; body.collision_mask = 0
		var node := Node3D.new(); add_child(node); node.add_child(body)
		var B := Builder.new(body)
		var placed: Array = []
		var count := rng.randi_range(10, 16)
		var guard := 0
		while placed.size() < count and guard < 400:
			guard += 1
			var a := rng.randf() * TAU
			var dist := sqrt(rng.randf()) * (t.r - 12.0)
			var x: float = t.pos.x + cos(a) * dist
			var z: float = t.pos.y + sin(a) * dist
			var big := rng.randf() < 0.18
			var w := rng.randf_range(16, 22) if big else rng.randf_range(8, 13)
			var d := rng.randf_range(12, 16) if big else rng.randf_range(7, 11)
			var clash := false
			for p in placed:
				if absf(p.x - x) < (p.w + w) * 0.5 + 5.0 and absf(p.z - z) < (p.d + d) * 0.5 + 5.0: clash = true
			if clash: continue
			var house := {"x": x, "z": z, "w": w, "d": d, "y": float(t.y), "floors": 2 if (not big and rng.randf() < 0.35) else 1, "door": rng.randi() % 4,
				"wood": rng.randf() < 0.6, "col": wood_cols[rng.randi() % wood_cols.size()], "pcol": plaster_cols[rng.randi() % plaster_cols.size()], "metal_roof": rng.randf() < 0.4}
			placed.append(house)
			_house(B, house)
		# caixotes e contêineres (cobertura)
		for k in rng.randi_range(4, 8):
			var a2 := rng.randf() * TAU; var r2: float = t.r * rng.randf_range(0.5, 1.1)
			var cx: float = t.pos.x + cos(a2) * r2; var cz: float = t.pos.y + sin(a2) * r2
			var cy := height_at(cx, cz)
			var clash2 := false
			for p in placed:
				if absf(p.x - cx) < p.w * 0.5 + 3.0 and absf(p.z - cz) < p.d * 0.5 + 3.0: clash2 = true
			if clash2: continue
			if rng.randf() < 0.5:
				var rot := rng.randf() < 0.5
				var sx := 2.4 if rot else 6.0; var sz := 6.0 if rot else 2.4
				B.box("metal", Vector3(cx - sx / 2, cy - 0.3, cz - sz / 2), Vector3(cx + sx / 2, cy + 2.6, cz + sz / 2), [Color("#9a3b2a"), Color("#2d5f8f"), Color("#4a6b3a"), Color("#b08a2c")][rng.randi() % 4])
			else:
				B.box("wood", Vector3(cx - 0.7, cy - 0.2, cz - 0.7), Vector3(cx + 0.7, cy + 1.3, cz + 0.7), Color("#9a7a4a"))
			loot_spots.append(Vector3(cx + 2.2, height_at(cx + 2.2, cz), cz))
		B.commit(node, mats)

func _house(B: Builder, H: Dictionary) -> void:
	var T := 0.3; var FH := 3.2; var DW := 1.6; var DH := 2.3
	var x0: float = H.x - H.w / 2.0; var x1: float = H.x + H.w / 2.0; var z0: float = H.z - H.d / 2.0; var z1: float = H.z + H.d / 2.0
	var y0: float = H.y
	var top: float = y0 + 0.2 + FH * H.floors
	H["top"] = top
	var wm := "wood" if H.wood else "plaster"
	var wc: Color = H.col if H.wood else H.pcol
	var trim := Color("#e6e0d0")
	B.box("plaster", Vector3(x0 - 0.06, y0 - 2.0, z0 - 0.06), Vector3(x1 + 0.06, y0 + 0.2, z1 + 0.06), Color("#8f8a80"))   # base/piso
	B.box("wood", Vector3(x0 + T, y0 + 0.19, z0 + T), Vector3(x1 - T, y0 + 0.21, z1 - T), Color("#8a6a48"), false)          # assoalho
	for side in 4:
		var along := side < 2
		var a0 := x0 if along else z0
		var a1 := x1 if along else z1
		var f := z0 if side == 0 else (z1 - T if side == 1 else (x0 if side == 2 else x1 - T))
		var mk := func(s0: float, s1: float, yy0: float, yy1: float, mat: String, col: Color, collide: bool) -> void:
			if along: B.box(mat, Vector3(s0, yy0, f), Vector3(s1, yy1, f + T), col, collide)
			else: B.box(mat, Vector3(f, yy0, s0), Vector3(f + T, yy1, s1), col, collide)
		var mid := (a0 + a1) * 0.5
		for fl in H.floors:
			var fy := y0 + 0.2 + FH * fl
			var fy1 := fy + FH
			if side == H.door and fl == 0:
				mk.call(a0, mid - DW / 2, fy, fy1, wm, wc, true)
				mk.call(mid + DW / 2, a1, fy, fy1, wm, wc, true)
				mk.call(mid - DW / 2, mid + DW / 2, fy + DH, fy1, wm, wc, true)
				mk.call(mid - DW / 2 - 0.1, mid - DW / 2, fy, fy + DH + 0.1, "wood", trim, false)
				mk.call(mid + DW / 2, mid + DW / 2 + 0.1, fy, fy + DH + 0.1, "wood", trim, false)
			else:
				# janela no meio da parede (dá pra atirar de dentro)
				var ww := 1.4; var wy0 := fy + 1.0; var wy1 := fy + 2.2
				mk.call(a0, mid - ww / 2, fy, fy1, wm, wc, true)
				mk.call(mid + ww / 2, a1, fy, fy1, wm, wc, true)
				mk.call(mid - ww / 2, mid + ww / 2, fy, wy0, wm, wc, true)
				mk.call(mid - ww / 2, mid + ww / 2, wy1, fy1, wm, wc, true)
				mk.call(mid - ww / 2 - 0.09, mid + ww / 2 + 0.09, wy0 - 0.09, wy0, "wood", trim, false)
				mk.call(mid - ww / 2 - 0.09, mid + ww / 2 + 0.09, wy1, wy1 + 0.09, "wood", trim, false)
	# 2º andar com escada
	if H.floors == 2:
		var fy2 := y0 + 0.2 + FH
		var sw := 1.4; var sx0 := x1 - T - sw; var slen: float = minf(H.d - 1.2, 6.5)
		B.box("wood", Vector3(x0 + T, fy2 - 0.25, z0 + T), Vector3(sx0, fy2, z1 - T), Color("#8a6a48"))
		B.box("wood", Vector3(sx0, fy2 - 0.25, z0 + slen + 0.2), Vector3(x1 - T, fy2, z1 - T), Color("#8a6a48"))
		var steps := 12
		for s in steps:
			var sz := z0 + T + (slen - T) * (float(s) / steps)
			B.box("wood", Vector3(sx0, y0 + 0.2, sz), Vector3(x1 - T, y0 + 0.2 + FH * float(s + 1) / steps, sz + (slen - T) / steps), Color("#7a5a3a"))
		loot_spots.append(Vector3(x0 + 1.5 + rng.randf() * (H.w - 4.5), fy2 + 0.05, z0 + 1.5 + rng.randf() * (H.d - 3.0)))
	# laje + telhado de duas águas (visual) com beiral
	B.box("plaster", Vector3(x0 - 0.2, top, z0 - 0.2), Vector3(x1 + 0.2, top + 0.25, z1 + 0.2), Color("#4a4038"))
	var ov := 0.45; var t2 := top + 0.25
	var along_x: bool = H.w >= H.d
	var half: float = (H.d if along_x else H.w) / 2.0 + ov
	var rise := half * 0.55
	var L0: float = (x0 if along_x else z0) - ov
	var L1: float = (x1 if along_x else z1) + ov
	var c: float = H.z if along_x else H.x
	var P := func(l: float, s: float, yy: float) -> Vector3: return Vector3(l, yy, c + s) if along_x else Vector3(c + s, yy, l)
	var rm := "roof_metal" if H.metal_roof else "roof_tile"
	var rc := Color("#b8b4ac") if H.metal_roof else Color("#a5553a")
	for sgn in [-1.0, 1.0]:
		var a: Vector3 = P.call(L0, sgn * half, t2); var b: Vector3 = P.call(L1, sgn * half, t2)
		var cc: Vector3 = P.call(L1, 0.0, t2 + rise); var dd: Vector3 = P.call(L0, 0.0, t2 + rise)
		var out := (P.call(0.0, sgn, 0.0) as Vector3) - (P.call(0.0, 0.0, 0.0) as Vector3) + Vector3.UP
		B.tri(rm, a, b, cc, rc, out); B.tri(rm, a, cc, dd, rc, out)
	var hh := half - ov
	for e in [(x0 if along_x else z0) + 0.01, (x1 if along_x else z1) - 0.01]:
		var outv := (P.call(e, 0.0, 0.0) as Vector3) - Vector3(H.x, 0, H.z)
		B.tri(wm, P.call(e, hh, t2), P.call(e, -hh, t2), P.call(e, 0.0, t2 + rise * (hh / half)), wc, Vector3(outv.x, 0, outv.z))
	houses.append(H)
	for k in rng.randi_range(1, 3):
		loot_spots.append(Vector3(x0 + 1.2 + rng.randf() * (H.w - 4.0), y0 + 0.25, z0 + 1.2 + rng.randf() * (H.d - 2.4)))

func _props() -> void:
	# loot espalhado pelo campo
	for k in 220:
		var p := random_land_point(rng, 0.85)
		loot_spots.append(p)

# ---------------------------------------------------------------- vegetação
func _merge(parts: Array) -> Array:
	var verts := PackedVector3Array(); var norms := PackedVector3Array(); var uvs := PackedVector2Array(); var idx := PackedInt32Array()
	for p in parts:
		var a: Array = (p[0] as PrimitiveMesh).get_mesh_arrays()
		var tr: Transform3D = p[1]
		var base := verts.size()
		for v in a[Mesh.ARRAY_VERTEX]: verts.append(tr * v)
		for n in a[Mesh.ARRAY_NORMAL]: norms.append((tr.basis * n).normalized())
		for u in a[Mesh.ARRAY_TEX_UV]: uvs.append(u)
		for i in a[Mesh.ARRAY_INDEX]: idx.append(base + i)
	var arr := []; arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = verts; arr[Mesh.ARRAY_NORMAL] = norms; arr[Mesh.ARRAY_TEX_UV] = uvs; arr[Mesh.ARRAY_INDEX] = idx
	return arr

func _cyl(r_top: float, r_bot: float, hgt: float, seg := 8) -> CylinderMesh:
	var c := CylinderMesh.new(); c.top_radius = r_top; c.bottom_radius = r_bot; c.height = hgt; c.radial_segments = seg; c.rings = 1
	return c

func _tree_meshes() -> Array:
	var trunk := _merge([[_cyl(0.13, 0.3, 4.4, 7), Transform3D(Basis(), Vector3(0, 2.2, 0))]])
	var pine_parts := []
	for k in 5:
		pine_parts.append([_cyl(0.0, 2.3 - k * 0.38, 2.6 - k * 0.2, 9), Transform3D(Basis(Vector3.UP, k * 0.7), Vector3(0, 3.0 + k * 1.15, 0))])
	var leaf_parts := []
	for b in [[0, 5.0, 0, 2.2], [1.2, 4.3, 0.5, 1.6], [-1.1, 4.5, -0.4, 1.7], [0.2, 6.0, -0.8, 1.5], [-0.4, 5.5, 1.1, 1.5]]:
		var s := SphereMesh.new(); s.radius = b[3]; s.height = b[3] * 1.7; s.radial_segments = 10; s.rings = 6
		leaf_parts.append([s, Transform3D(Basis(), Vector3(b[0], b[1], b[2]))])
	var pine := ArrayMesh.new()
	pine.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, trunk); pine.surface_set_material(0, mats["bark"])
	pine.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, _merge(pine_parts)); pine.surface_set_material(1, mats["pine"])
	var leaf := ArrayMesh.new()
	leaf.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, trunk); leaf.surface_set_material(0, mats["bark"])
	leaf.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, _merge(leaf_parts)); leaf.surface_set_material(1, mats["foliage"])
	var rockm := ArrayMesh.new()
	var rs := SphereMesh.new(); rs.radius = 1.0; rs.height = 1.3; rs.radial_segments = 7; rs.rings = 4
	rockm.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, _merge([[rs, Transform3D()]])); rockm.surface_set_material(0, mats["rock"])
	var bushm := ArrayMesh.new()
	var bs := SphereMesh.new(); bs.radius = 0.8; bs.height = 1.2; bs.radial_segments = 8; bs.rings = 5
	bushm.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, _merge([[bs, Transform3D(Basis(), Vector3(0, 0.4, 0))]])); bushm.surface_set_material(0, mats["bush"])
	return [pine, leaf, rockm, bushm]

func _vegetation() -> void:
	var meshes := _tree_meshes()
	var per_sector := {}   # chave "si,sj,tipo" -> Array[Transform3D]
	var colliders := {}    # chave setor -> StaticBody3D
	var add := func(kind: int, tr: Transform3D, col_r: float, col_h: float) -> void:
		var si := clampi(int((tr.origin.x + Game.HALF) / Game.MAP_SIZE * 4.0), 0, 3)
		var sj := clampi(int((tr.origin.z + Game.HALF) / Game.MAP_SIZE * 4.0), 0, 3)
		var key := "%d,%d,%d" % [si, sj, kind]
		if not per_sector.has(key): per_sector[key] = []
		per_sector[key].append(tr)
		if col_r > 0.0:
			var sk := "%d,%d" % [si, sj]
			if not colliders.has(sk):
				var b := StaticBody3D.new(); b.collision_layer = Game.L_WORLD; b.collision_mask = 0; add_child(b); colliders[sk] = b
			var cs := CollisionShape3D.new(); var cy := CylinderShape3D.new(); cy.radius = col_r; cy.height = col_h
			cs.shape = cy; cs.position = tr.origin + Vector3(0, col_h * 0.5, 0)
			(colliders[sk] as StaticBody3D).add_child(cs)
	var count := 0
	for i in 9000:
		if count >= 2600: break
		var x := rng.randf_range(-1, 1) * Game.HALF; var z := rng.randf_range(-1, 1) * Game.HALF
		var y := height_at(x, z)
		if y < 2.5 or y > 64.0 or near_town(x, z, 8.0): continue
		if noise2.get_noise_2d(x * 3.0, z * 3.0) < -0.05 and rng.randf() < 0.85: continue
		var s := rng.randf_range(0.8, 1.5)
		var kind := 0 if (y > 32.0 or rng.randf() < 0.55) else 1
		add.call(kind, Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(s, s * rng.randf_range(0.95, 1.2), s)), Vector3(x, y - 0.2, z)), 0.35 * s, 7.0 * s)
		count += 1
	for i in 900:
		var x := rng.randf_range(-1, 1) * Game.HALF; var z := rng.randf_range(-1, 1) * Game.HALF
		var y := height_at(x, z)
		if y < 0.5 or near_town(x, z, 6.0): continue
		var s := 0.6 + pow(rng.randf(), 2.0) * 2.6
		add.call(2, Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(s, s * 0.8, s * rng.randf_range(0.7, 1.2))), Vector3(x, y - s * 0.25, z)), s * 0.85, s * 1.2)
	for i in 7000:
		var x := rng.randf_range(-1, 1) * Game.HALF; var z := rng.randf_range(-1, 1) * Game.HALF
		var y := height_at(x, z)
		if y < 2.0 or y > 50.0 or near_town(x, z, 2.0): continue
		var s := rng.randf_range(0.5, 1.3)
		add.call(3, Transform3D(Basis().scaled(Vector3(s, s, s)), Vector3(x, y, z)), 0.0, 0.0)
	for key in per_sector:
		var kind := int(String(key).get_slice(",", 2))
		var list: Array = per_sector[key]
		list.shuffle()
		var mm := MultiMesh.new(); mm.transform_format = MultiMesh.TRANSFORM_3D; mm.use_colors = true
		mm.mesh = meshes[kind]; mm.instance_count = list.size()
		for k in list.size():
			mm.set_instance_transform(k, list[k])
			var v := rng.randf_range(0.8, 1.2)
			mm.set_instance_color(k, Color(v, v * rng.randf_range(0.95, 1.08), v))
		var mmi := MultiMeshInstance3D.new(); mmi.multimesh = mm
		mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if kind != 3 else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mmi)
		tree_mms.append([mmi, list.size(), kind])

# ---------------------------------------------------------------- capim (blocos ao redor da câmera)
func _grass_setup() -> void:
	# máscara de onde nasce capim
	var N := Game.GRID_N
	grass_mask.resize(N * N)
	for j in N:
		for i in N:
			var x := i * Game.GRID - Game.HALF; var z := j * Game.GRID - Game.HALF
			var y := h[j * N + i]
			var ok := y > 3.0 and y < 56.0 and slope_at(x, z) < 0.45
			var dens := 1.0
			if ok:
				if noise2.get_noise_2d(x * 6.0, z * 6.0) * 0.5 + 0.5 > 0.7: dens = 0.25
				for t in towns:
					var dd: float = t.pos.distance_to(Vector2(x, z))
					if dd < t.r: dens *= 0.3 + 0.7 * dd / t.r
			grass_mask[j * N + i] = int(dens * 255.0) if ok else 0
	for H in houses:
		var i0 := int((H.x - H.w / 2.0 - 1.5 + Game.HALF) / Game.GRID); var i1 := int((H.x + H.w / 2.0 + 1.5 + Game.HALF) / Game.GRID) + 1
		var j0 := int((H.z - H.d / 2.0 - 1.5 + Game.HALF) / Game.GRID); var j1 := int((H.z + H.d / 2.0 + 1.5 + Game.HALF) / Game.GRID) + 1
		for j in range(maxi(0, j0), mini(N, j1 + 1)):
			for i in range(maxi(0, i0), mini(N, i1 + 1)): grass_mask[j * N + i] = 0
	# tufo: 3 planos cruzados (UV.y = 1 na base)
	var st := SurfaceTool.new(); st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for k in 3:
		var a := k * PI / 3.0
		var dx := Vector3(cos(a), 0, sin(a)) * 0.55
		var p := [-dx, dx, dx + Vector3(0, 1, 0), -dx + Vector3(0, 1, 0)]
		var uv := [Vector2(0, 1), Vector2(1, 1), Vector2(1, 0), Vector2(0, 0)]
		for idx in [0, 1, 2, 0, 2, 3]:
			st.set_normal(Vector3.UP); st.set_uv(uv[idx]); st.add_vertex(p[idx])
	grass_mesh = st.commit()
	grass_mesh.surface_set_material(0, grass_mat)
	grass_root = Node3D.new(); add_child(grass_root)

func grass_density(x: float, z: float) -> float:
	var N := Game.GRID_N
	var i := clampi(int(round((x + Game.HALF) / Game.GRID)), 0, N - 1); var j := clampi(int(round((z + Game.HALF) / Game.GRID)), 0, N - 1)
	return grass_mask[j * N + i] / 255.0

func _make_grass_tile(ti: int, tj: int) -> MultiMeshInstance3D:
	var r := RandomNumberGenerator.new(); r.seed = hash(Vector2i(ti, tj)) ^ seed_value
	var n := int(GRASS_TILE * GRASS_TILE * 2.2 * float(grass_cfg[1]))
	var xs: Array = []
	for k in n:
		var x := ti * GRASS_TILE + r.randf() * GRASS_TILE
		var z := tj * GRASS_TILE + r.randf() * GRASS_TILE
		if r.randf() > grass_density(x, z): continue
		xs.append(Vector3(x, height_at(x, z), z))
	var mm := MultiMesh.new(); mm.transform_format = MultiMesh.TRANSFORM_3D; mm.use_colors = true; mm.mesh = grass_mesh
	mm.instance_count = xs.size()
	for k in xs.size():
		var s := r.randf_range(0.6, 1.25)
		mm.set_instance_transform(k, Transform3D(Basis(Vector3.UP, r.randf() * TAU).scaled(Vector3(s, s * r.randf_range(0.8, 1.4), s)), xs[k] - Vector3(0, 0.05, 0)))
		mm.set_instance_color(k, Color(r.randf(), 1, 1))
	var mmi := MultiMeshInstance3D.new(); mmi.multimesh = mm
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mmi.visibility_range_end = float(grass_cfg[0]) + GRASS_TILE
	return mmi

func update_grass(cam_pos: Vector3) -> void:
	if grass_root == null: return
	var R := float(grass_cfg[0])
	if R <= 0.0:
		if not grass_tiles.is_empty():
			for k in grass_tiles: (grass_tiles[k] as Node).queue_free()
			grass_tiles.clear()
		return
	var ci := int(floor(cam_pos.x / GRASS_TILE)); var cj := int(floor(cam_pos.z / GRASS_TILE))
	var rt := int(ceil(R / GRASS_TILE))
	var want := {}
	var made := 0
	for dj in range(-rt, rt + 1):
		for di in range(-rt, rt + 1):
			if Vector2(di, dj).length() * GRASS_TILE > R + GRASS_TILE: continue
			var key := Vector2i(ci + di, cj + dj)
			want[key] = true
			if not grass_tiles.has(key) and made < 6:   # no máximo 6 blocos novos por quadro (sem travadas)
				var t := _make_grass_tile(key.x, key.y); grass_root.add_child(t); grass_tiles[key] = t; made += 1
	for k in grass_tiles.keys():
		if not want.has(k):
			(grass_tiles[k] as Node).queue_free(); grass_tiles.erase(k)

func apply_quality(T: Dictionary, _tier: int) -> void:
	var cfg: Array = T.grass
	if cfg[0] != grass_cfg[0] or cfg[1] != grass_cfg[1]:
		grass_cfg = cfg.duplicate()
		for k in grass_tiles: (grass_tiles[k] as Node).queue_free()
		grass_tiles.clear()
	for e in tree_mms:
		var mmi: MultiMeshInstance3D = e[0]
		var frac := float(T.veg) if int(e[2]) != 3 else (float(T.veg) if _tier >= 1 else 0.0)
		mmi.multimesh.visible_instance_count = int(int(e[1]) * frac)
		mmi.visibility_range_end = float(T.view)

# ---------------------------------------------------------------- mapa (imagem para o minimapa / mapa grande)
func make_map_image(size := 512) -> ImageTexture:
	var img := Image.create(size, size, false, Image.FORMAT_RGB8)
	for j in size:
		for i in size:
			var x := (float(i) / size) * Game.MAP_SIZE - Game.HALF; var z := (float(j) / size) * Game.MAP_SIZE - Game.HALF
			var y := height_at(x, z)
			var c: Color
			if y < 0.0: c = Color(0.16, 0.40, 0.55).darkened(clampf(-y / 12.0, 0.0, 0.5))
			elif y < 2.4: c = Color(0.85, 0.78, 0.58)
			else: c = Color(0.42, 0.52, 0.26).lerp(Color(0.62, 0.58, 0.46), clampf(y / 70.0, 0.0, 1.0))
			var shade := (height_at(x - 4.0, z - 4.0) - y) * 0.05
			img.set_pixel(i, j, c.lightened(clampf(shade, 0.0, 0.3)).darkened(clampf(-shade, 0.0, 0.3)))
	for H in houses:
		var r := Rect2i(int((H.x - H.w / 2.0 + Game.HALF) / Game.MAP_SIZE * size), int((H.z - H.d / 2.0 + Game.HALF) / Game.MAP_SIZE * size), maxi(1, int(H.w / Game.MAP_SIZE * size)), maxi(1, int(H.d / Game.MAP_SIZE * size)))
		img.fill_rect(r, Color(0.35, 0.28, 0.22))
	return ImageTexture.create_from_image(img)

extends RefCounted
class_name WeaponModels
## Modelos de armas e itens montados com peças geométricas (sem arquivos externos).

static var _mats = {}

static func _m(c: Color, metal = 0.5, rough = 0.45) -> StandardMaterial3D:
	var k = "%s_%s_%s" % [c.to_html(), metal, rough]
	if not _mats.has(k):
		var m = StandardMaterial3D.new(); m.albedo_color = c; m.metallic = metal; m.roughness = rough
		_mats[k] = m
	return _mats[k]

static func _box(n: Node3D, size: Vector3, pos: Vector3, mat: Material, rot_x = 0.0) -> void:
	var mi = MeshInstance3D.new(); var b = BoxMesh.new(); b.size = size; mi.mesh = b; mi.material_override = mat
	mi.position = pos; mi.rotation.x = rot_x; n.add_child(mi)

static func _cyl(n: Node3D, r: float, length: float, pos: Vector3, mat: Material) -> void:
	var mi = MeshInstance3D.new(); var c = CylinderMesh.new(); c.top_radius = r; c.bottom_radius = r; c.height = length; c.radial_segments = 10
	mi.mesh = c; mi.material_override = mat; mi.position = pos; mi.rotation.x = PI / 2.0; n.add_child(mi)

## Arma apontando para -Z, origem na empunhadura.
static func build(id: String, scoped = false) -> Node3D:
	var n = Node3D.new()
	var blk = _m(Color(0.13, 0.14, 0.15), 0.6, 0.4)
	var mt = _m(Color(0.25, 0.27, 0.29), 0.8, 0.35)
	var wood = _m(Color(0.42, 0.28, 0.17), 0.0, 0.7)
	var tan = _m(Color(0.55, 0.49, 0.36), 0.1, 0.7)
	match id:
		"p9":
			_box(n, Vector3(0.035, 0.05, 0.2), Vector3(0, 0.05, -0.08), mt)
			_box(n, Vector3(0.032, 0.11, 0.045), Vector3(0, -0.01, 0.0), blk, 0.25)
		"t12":
			_cyl(n, 0.02, 0.75, Vector3(0, 0.06, -0.45), mt)
			_cyl(n, 0.017, 0.55, Vector3(0, 0.02, -0.4), blk)
			_box(n, Vector3(0.06, 0.07, 0.24), Vector3(0, 0.04, -0.03), blk)
			_box(n, Vector3(0.065, 0.06, 0.18), Vector3(0, 0.01, -0.42), wood)
			_box(n, Vector3(0.05, 0.1, 0.32), Vector3(0, 0.0, 0.23), wood, -0.15)
		"lince", "falcao", "trovao":
			var L = 1.15 if id == "trovao" else 1.0
			_cyl(n, 0.016, 0.85 * L, Vector3(0, 0.06, -0.62 * L), mt)
			_box(n, Vector3(0.06, 0.07, 0.45), Vector3(0, 0.04, -0.1), wood if id != "trovao" else tan)
			_box(n, Vector3(0.055, 0.12, 0.36), Vector3(0, 0.0, 0.25), wood if id != "trovao" else tan, -0.12)
			_box(n, Vector3(0.035, 0.07, 0.06), Vector3(0, -0.02, -0.02), blk)
			scoped = true
		_:
			# fuzis / submetralhadora / metralhadora
			var smg = id == "vespa"
			var L2 = 0.8 if smg else (1.15 if id == "m9" else 1.0)
			var body = blk if (smg or id == "m12") else tan
			_box(n, Vector3(0.055, 0.085, 0.42 * L2), Vector3(0, 0.04, -0.08), blk)
			_cyl(n, 0.014, 0.4 * L2, Vector3(0, 0.06, -0.47 * L2), mt)
			_box(n, Vector3(0.06, 0.06, 0.24 * L2), Vector3(0, 0.045, -0.38 * L2), body)
			_box(n, Vector3(0.045, 0.16 if id != "m9" else 0.1, 0.06), Vector3(0, -0.07, -0.13), blk, -0.25 if id == "m12" else 0.0)
			_box(n, Vector3(0.04, 0.1, 0.05), Vector3(0, -0.05, 0.07), blk, 0.35)
			_box(n, Vector3(0.05, 0.08, 0.26 * L2), Vector3(0, 0.03, 0.25 * L2), body, -0.05)
			if id == "m9": _box(n, Vector3(0.12, 0.12, 0.14), Vector3(0.0, -0.06, -0.12), mt)
	if scoped:
		_cyl(n, 0.026, 0.3, Vector3(0, 0.13, -0.1), blk)
		_cyl(n, 0.034, 0.05, Vector3(0, 0.13, -0.27), blk)
	return n

## Visual de item no chão.
static func build_item(t: String) -> Node3D:
	if Game.WEAPONS.has(t):
		var w = build(t); w.rotation = Vector3(0, 0, PI / 2.0); w.position.y = 0.06; return w
	var n = Node3D.new()
	if t.begins_with("ammo:"): _box(n, Vector3(0.3, 0.16, 0.2), Vector3(0, 0.08, 0), _m(Color(0.45, 0.42, 0.2), 0.3, 0.6))
	elif t == "bandage": _box(n, Vector3(0.2, 0.1, 0.12), Vector3(0, 0.05, 0), _m(Color(0.9, 0.88, 0.82), 0.0, 0.9))
	elif t == "firstaid":
		_box(n, Vector3(0.32, 0.18, 0.12), Vector3(0, 0.09, 0), _m(Color(0.8, 0.8, 0.75), 0.0, 0.8))
		_box(n, Vector3(0.18, 0.05, 0.13), Vector3(0, 0.1, 0), _m(Color(0.75, 0.12, 0.12), 0.0, 0.7))
	elif t == "medkit":
		_box(n, Vector3(0.45, 0.3, 0.15), Vector3(0, 0.15, 0), _m(Color(0.75, 0.15, 0.13), 0.0, 0.6))
		_box(n, Vector3(0.22, 0.06, 0.16), Vector3(0, 0.16, 0), _m(Color(0.95, 0.95, 0.95), 0.0, 0.6))
	elif t == "drink": _cyl(n, 0.04, 0.16, Vector3(0, 0.04, 0), _m(Color(0.2, 0.55, 0.85), 0.7, 0.3))
	elif t == "pills": _box(n, Vector3(0.12, 0.06, 0.08), Vector3(0, 0.03, 0), _m(Color(0.95, 0.85, 0.3), 0.0, 0.5))
	elif t.begins_with("vest"): _box(n, Vector3(0.46, 0.55, 0.16), Vector3(0, 0.1, 0), _m(Color(0.3, 0.33, 0.24).lightened(int(t.substr(4)) * 0.05), 0.0, 0.9), -PI / 2.0)
	elif t.begins_with("helmet"):
		var mi = MeshInstance3D.new(); var s = SphereMesh.new(); s.radius = 0.17; s.height = 0.17; s.is_hemisphere = true; mi.mesh = s
		mi.material_override = _m(Color(0.3, 0.35, 0.24).lightened(int(t.substr(6)) * 0.05), 0.2, 0.6); n.add_child(mi)
	elif t.begins_with("pack"): _box(n, Vector3(0.4, 0.45, 0.25), Vector3(0, 0.12, 0), _m(Color(0.32, 0.36, 0.22), 0.0, 0.9), -PI / 2.0)
	else: _box(n, Vector3(0.15, 0.08, 0.15), Vector3(0, 0.04, 0), _m(Color(0.15, 0.15, 0.15), 0.6, 0.4))
	return n

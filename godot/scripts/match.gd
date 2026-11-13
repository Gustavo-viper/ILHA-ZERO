extends Node3D
## Partida: avião, zonas, loot, balas, dano, mortes, vitória e sincronização em rede (LAN).
## O host (ou o jogo offline) é a autoridade: decide dano, mortes, zona, loot, bots e eventos.

signal killfeed(text: String, mine: bool)
signal announce(text: String)
signal match_ended(text: String)

const ZONE_PHASES = [
	{"wait": 90.0, "shrink": 60.0, "f": 0.62, "dps": 0.6},
	{"wait": 70.0, "shrink": 50.0, "f": 0.55, "dps": 1.0},
	{"wait": 60.0, "shrink": 40.0, "f": 0.5, "dps": 2.0},
	{"wait": 50.0, "shrink": 35.0, "f": 0.5, "dps": 4.0},
	{"wait": 40.0, "shrink": 30.0, "f": 0.45, "dps": 7.0},
	{"wait": 30.0, "shrink": 30.0, "f": 0.4, "dps": 10.0},
	{"wait": 25.0, "shrink": 25.0, "f": 0.01, "dps": 14.0},
]

var world
var match_seed = 1
var mrng = RandomNumberGenerator.new()
var time = 0.0
var phase = "countdown"     # countdown, plane, playing, ended
var local: Soldier
var soldiers_node: Node3D
var loot = {}               # id -> {id, type, amount, pos, node}
var next_loot_id = 100000
var plane = {}              # a, b (Vector3), t0, dur, node
var zone = {"c": Vector2.ZERO, "r": 2000.0, "tc": Vector2.ZERO, "tr": 2000.0, "timer": 0.0, "stage": -1, "shrinking": false, "dps": 0.4, "sc": Vector2.ZERO, "sr": 2000.0, "dur": 1.0}
var zone_plan: Array = []
var zone_mesh: MeshInstance3D
var redzone = {}            # c, r, until
var total_players = 0
var bullets: Array = []
var tracer_pool: Array = []
var sfx_pool: Array = []
var sfx = {}
var _sync_acc = 0.0
var _zone_acc = 0.0
var _time_acc = 0.0
var _event_t = 0.0
var _care_t = 0.0
var ended = false

# ---------------------------------------------------------------- início
func start(w: Node, seed_in: int, humans: Array, bot_count: int, my_peer: int) -> void:
	world = w; match_seed = seed_in; mrng.seed = seed_in * 31 + 7
	soldiers_node = Node3D.new(); soldiers_node.name = "Soldiers"; add_child(soldiers_node)
	_make_sfx()
	for i in 48:
		var mi = MeshInstance3D.new(); var bm = BoxMesh.new(); bm.size = Vector3(0.025, 0.025, 1.0); mi.mesh = bm
		var m = StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.albedo_color = Color(1.0, 0.85, 0.45); m.emission_enabled = true; m.emission = Color(1, 0.8, 0.4); m.emission_energy_multiplier = 3.0
		mi.material_override = m; mi.visible = false; mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mi); tracer_pool.append(mi)
	# soldados (nomes determinísticos em todos os computadores)
	var tint = 0
	for hdef in humans:
		var s = Soldier.new(); s.name = "p%d" % int(hdef[0]); s.peer_id = int(hdef[0])
		soldiers_node.add_child(s)
		s.setup(self, world, String(hdef[1]), false, int(hdef[0]) == my_peer, tint); tint += 1
		if s.is_local: local = s
	for i in bot_count:
		var b = Soldier.new(); b.name = "b%d" % i; b.peer_id = 1
		soldiers_node.add_child(b)
		b.setup(self, world, Game.BOT_NAMES[i % Game.BOT_NAMES.size()] + ("" if i < Game.BOT_NAMES.size() else str(i)), true, false, i + 3)
	total_players = humans.size() + bot_count
	for s in soldiers():
		s.state = "plane"; s.visible = false
		s.give("p9"); s.ammo["9mm"] = 15
	# loot inicial (mesma sequência em todos os peers → mesmos ids)
	var id = 1
	for p in world.loot_spots:
		if mrng.randf() < 0.15: continue
		var t = Game.roll_loot(mrng)
		_add_loot(id, t, _default_amount(t), p + Vector3(mrng.randf_range(-0.4, 0.4), 0.05, mrng.randf_range(-0.4, 0.4))); id += 1
		if Game.WEAPONS.has(t):
			var at: String = "ammo:" + String(Game.WEAPONS[t].ammo)
			_add_loot(id, at, _default_amount(at), p + Vector3(0.6, 0.05, 0.3)); id += 1
	# plano da zona (determinístico)
	var c = Vector2.ZERO; var r = Game.HALF * 1.5
	for k in ZONE_PHASES.size():
		var ph: Dictionary = ZONE_PHASES[k]
		var nr = Game.HALF * 0.75 if k == 0 else r * float(ph.f)
		var nc = c
		for tries in 40:
			var a = mrng.randf() * TAU; var d = mrng.randf() * maxf(0.0, r - nr) * (0.3 if k == 0 else 0.9)
			nc = c + Vector2(cos(a), sin(a)) * d
			if world.height_at(nc.x, nc.y) > 1.5: break
		zone_plan.append({"c": nc, "r": nr})
		c = nc; r = nr
	zone.c = Vector2.ZERO; zone.r = Game.HALF * 1.5; zone.sc = zone.c; zone.sr = zone.r
	_next_zone()
	# zona: parede azul
	zone_mesh = MeshInstance3D.new()
	var cm = CylinderMesh.new(); cm.top_radius = 1.0; cm.bottom_radius = 1.0; cm.height = 800.0; cm.radial_segments = 128; cm.cap_top = false; cm.cap_bottom = false
	zone_mesh.mesh = cm
	var zm = ShaderMaterial.new(); zm.shader = load("res://shaders/zone.gdshader"); zone_mesh.material_override = zm
	zone_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(zone_mesh)
	# avião
	var a2 = mrng.randf() * TAU; var off = mrng.randf_range(-0.4, 0.4) * Game.HALF
	var dir = Vector3(cos(a2), 0, sin(a2)); var perp = Vector3(-dir.z, 0, dir.x)
	var L = Game.HALF * 1.2
	plane = {"a": -dir * L + perp * off + Vector3(0, 420, 0), "b": dir * L + perp * off + Vector3(0, 420, 0), "t0": 8.0}
	plane["dur"] = (plane.b - plane.a).length() / 75.0
	plane["node"] = _make_plane_mesh(); add_child(plane["node"])
	phase = "countdown"; time = 0.0
	announce.emit("O avião decola em 8 segundos")

func _default_amount(t: String) -> int:
	if t.begins_with("ammo:"): return int(Game.AMMO.get(t.substr(5), 30))
	if Game.WEAPONS.has(t): return int(Game.WEAPONS[t].mag)
	return 1

func soldiers() -> Array:
	return soldiers_node.get_children() if soldiers_node else []

func alive_count() -> int:
	var n = 0
	for s in soldiers():
		if s.alive: n += 1
	return n

func find_soldier(n: String) -> Soldier:
	return soldiers_node.get_node_or_null(n) as Soldier

# ---------------------------------------------------------------- avião
func _make_plane_mesh() -> Node3D:
	var n = Node3D.new()
	var body = StandardMaterial3D.new(); body.albedo_color = Color(0.62, 0.65, 0.6); body.metallic = 0.5; body.roughness = 0.45
	var dark = StandardMaterial3D.new(); dark.albedo_color = Color(0.2, 0.22, 0.24)
	var f = MeshInstance3D.new(); var cap = CapsuleMesh.new(); cap.radius = 2.4; cap.height = 30.0; f.mesh = cap; f.rotation.x = PI / 2.0; f.material_override = body; n.add_child(f)
	var wg = MeshInstance3D.new(); var wb = BoxMesh.new(); wb.size = Vector3(40, 0.5, 6); wg.mesh = wb; wg.position = Vector3(0, 1.0, -1.0); wg.material_override = body; n.add_child(wg)
	var tl = MeshInstance3D.new(); var tb = BoxMesh.new(); tb.size = Vector3(0.5, 7, 4.5); tl.mesh = tb; tl.position = Vector3(0, 4.0, 13.0); tl.material_override = body; n.add_child(tl)
	var tw = MeshInstance3D.new(); var twb = BoxMesh.new(); twb.size = Vector3(14, 0.4, 3.5); tw.mesh = twb; tw.position = Vector3(0, 1.5, 13.0); tw.material_override = body; n.add_child(tw)
	for x in [-7.0, -13.0, 7.0, 13.0]:
		var e = MeshInstance3D.new(); var cy = CylinderMesh.new(); cy.top_radius = 1.0; cy.bottom_radius = 1.2; cy.height = 4.5; e.mesh = cy; e.rotation.x = PI / 2.0; e.position = Vector3(x, 0.4, -3.5); e.material_override = dark; n.add_child(e)
	return n

func plane_pos() -> Vector3:
	var k = clampf((time - float(plane.t0)) / float(plane.dur), 0.0, 1.0)
	return (plane.a as Vector3).lerp(plane.b, k)

func plane_progress() -> float:
	return (time - float(plane.t0)) / float(plane.dur)

# ---------------------------------------------------------------- laço principal
func _physics_process(dt: float) -> void:
	if world == null or ended: return
	time += dt
	var server = multiplayer.is_server()
	# avião
	if plane.has("node"):
		var pn: Node3D = plane.node
		var pr = plane_progress()
		pn.visible = pr > -0.2 and pr < 1.05
		pn.global_position = plane_pos()
		pn.look_at(pn.global_position + (plane.b - plane.a).normalized(), Vector3.UP)
	if phase == "countdown" and time >= float(plane.t0):
		phase = "plane"; announce.emit("Aperte F para saltar do avião")
	if phase == "plane" or phase == "playing":
		var pp = plane_pos(); var pr2 = plane_progress()
		for s in soldiers():
			if s.state != "plane": continue
			s.global_position = pp
			var auto_jump = pr2 >= 0.98
			if s.is_bot and server and pr2 >= float(s.ai.jump_at) and world.height_at(pp.x, pp.z) > 1.0: auto_jump = true
			if auto_jump and (s.is_local or (s.is_bot and server)): s.jump_from_plane(pp)
		if phase == "plane" and pr2 > 0.15: phase = "playing"
	if phase == "playing" or phase == "plane": _update_zone(dt, server)
	_update_bullets(dt)
	if server: _server_events(dt)
	# sincronização de estado (~15 Hz)
	_sync_acc += dt
	if _sync_acc >= 1.0 / 15.0:
		_sync_acc = 0.0
		if local and multiplayer.has_multiplayer_peer() and not (multiplayer.multiplayer_peer is OfflineMultiplayerPeer):
			rpc_state.rpc(local.name, local.global_position, local.yaw, local.pitch, local.state, local.stance, _wid(local), local.visible)
			if server: _send_bots()
	if server:
		_time_acc += dt
		if _time_acc > 2.0 and not (multiplayer.multiplayer_peer is OfflineMultiplayerPeer):
			_time_acc = 0.0; rpc_time.rpc(time)
	if local and world: world.update_grass(get_viewport().get_camera_3d().global_position if get_viewport().get_camera_3d() else local.global_position)

func _wid(s: Soldier) -> String:
	var w = s.current_weapon()
	return String(w.id) if w != null else ""

# ---------------------------------------------------------------- zona azul
func _next_zone() -> void:
	zone.stage = int(zone.stage) + 1
	var k: int = mini(int(zone.stage), ZONE_PHASES.size() - 1)
	var ph: Dictionary = ZONE_PHASES[k]
	zone.sc = zone.c; zone.sr = zone.r
	zone.tc = zone_plan[k].c; zone.tr = zone_plan[k].r
	zone.timer = float(ph.wait); zone.dur = float(ph.shrink); zone.shrinking = false; zone.dps = float(ph.dps)
	if int(zone.stage) > 0: announce.emit("Nova área segura marcada no mapa!")

func _update_zone(dt: float, server: bool) -> void:
	zone.timer = float(zone.timer) - dt
	if not bool(zone.shrinking) and float(zone.timer) <= 0.0:
		if int(zone.stage) >= ZONE_PHASES.size() - 1 and float(zone.r) < 3.0: zone.timer = 9999.0
		else:
			zone.shrinking = true; zone.timer = float(zone.dur); zone.sc = zone.c; zone.sr = zone.r
			announce.emit("A zona azul está se fechando!")
	elif bool(zone.shrinking):
		var k = 1.0 - maxf(0.0, float(zone.timer)) / float(zone.dur)
		zone.c = (zone.sc as Vector2).lerp(zone.tc, k); zone.r = lerpf(float(zone.sr), float(zone.tr), k)
		if float(zone.timer) <= 0.0:
			zone.shrinking = false
			if int(zone.stage) < ZONE_PHASES.size() - 1: _next_zone()
			else: zone.timer = 9999.0
	zone_mesh.global_position = Vector3(zone.c.x, 200.0, zone.c.y)
	zone_mesh.scale = Vector3(float(zone.r), 1.0, float(zone.r))
	if server:
		_zone_acc += dt
		if _zone_acc >= 1.0:
			_zone_acc -= 1.0
			for s in soldiers():
				if not s.alive or s.state == "plane": continue
				if Vector2(s.global_position.x, s.global_position.z).distance_to(zone.c) > float(zone.r):
					_server_damage(s, -1, float(zone.dps) * (1.0 + int(zone.stage) * 0.15), null, "zona")

# ---------------------------------------------------------------- zona vermelha + caixas de suprimentos (host)
func _server_events(dt: float) -> void:
	if phase != "playing": return
	_event_t += dt; _care_t += dt
	if _event_t > 100.0 and int(zone.stage) < 5:
		_event_t = mrng.randf_range(0.0, 40.0)
		var a = mrng.randf() * TAU; var d = mrng.randf() * float(zone.r) * 0.7
		var c: Vector2 = zone.c + Vector2(cos(a), sin(a)) * d
		rpc_redzone.rpc(c, 90.0, time + 16.0)
	if not redzone.is_empty() and time < float(redzone.until) and mrng.randf() < dt * 3.5:
		var a2 = mrng.randf() * TAU; var d2 = sqrt(mrng.randf()) * float(redzone.r)
		var bc: Vector2 = redzone.c + Vector2(cos(a2), sin(a2)) * d2
		var p = Vector3(bc.x, world.height_at(bc.x, bc.y), bc.y)
		rpc_bomb.rpc(p)
		for s in soldiers():
			if not s.alive or s.state != "ground": continue
			var dist: float = s.global_position.distance_to(p)
			if dist < 6.0:
				# dentro de casa (com teto) fica protegido
				var q = PhysicsRayQueryParameters3D.create(s.global_position + Vector3(0, 1.7, 0), s.global_position + Vector3(0, 30, 0), Game.L_WORLD)
				if get_world_3d().direct_space_state.intersect_ray(q).is_empty():
					_server_damage(s, 1, 90.0 * (1.0 - dist / 6.0) + 15.0, null, "bombardeio")
	if _care_t > 140.0:
		_care_t = mrng.randf_range(-40.0, 0.0)
		var a3 = mrng.randf() * TAU; var d3 = mrng.randf() * float(zone.tr) * 0.8
		var cc: Vector2 = zone.tc + Vector2(cos(a3), sin(a3)) * d3
		rpc_care.rpc(Vector3(cc.x, world.height_at(cc.x, cc.y), cc.y), next_loot_id)
		next_loot_id += 10

@rpc("authority", "call_local", "reliable")
func rpc_redzone(c: Vector2, r: float, until: float) -> void:
	redzone = {"c": c, "r": r, "until": until}
	announce.emit("⚠ ZONA VERMELHA! Procure abrigo dentro de uma construção")

@rpc("authority", "call_local", "unreliable")
func rpc_bomb(p: Vector3) -> void:
	_explosion(p)

func _explosion(p: Vector3) -> void:
	var mi = MeshInstance3D.new(); var sm = SphereMesh.new(); sm.radius = 1.0; sm.height = 2.0; mi.mesh = sm
	var m = StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.albedo_color = Color(1.0, 0.55, 0.15); m.emission_enabled = true; m.emission = Color(1, 0.5, 0.1); m.emission_energy_multiplier = 6.0
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mi.material_override = m; mi.position = p; add_child(mi)
	var light = OmniLight3D.new(); light.light_color = Color(1, 0.6, 0.3); light.light_energy = 8.0; light.omni_range = 25.0; light.position = p + Vector3(0, 2, 0); add_child(light)
	var tw = create_tween()
	tw.tween_property(mi, "scale", Vector3.ONE * 7.0, 0.35)
	tw.parallel().tween_property(m, "albedo_color:a", 0.0, 0.6)
	tw.parallel().tween_property(light, "light_energy", 0.0, 0.6)
	tw.tween_callback(mi.queue_free)
	tw.tween_callback(light.queue_free)
	play_sfx("bomb", p)

@rpc("authority", "call_local", "reliable")
func rpc_care(p: Vector3, base_id: int) -> void:
	announce.emit("📦 Caixa de suprimentos caindo! (fumaça vermelha)")
	var crate = Node3D.new(); add_child(crate)
	var box = MeshInstance3D.new(); var bm = BoxMesh.new(); bm.size = Vector3(1.4, 1.0, 1.4); box.mesh = bm
	var mat = StandardMaterial3D.new(); mat.albedo_color = Color(0.3, 0.42, 0.62); box.material_override = mat; box.position.y = 0.5; crate.add_child(box)
	var ch = MeshInstance3D.new(); var sm = SphereMesh.new(); sm.radius = 2.5; sm.height = 2.0; sm.is_hemisphere = true; ch.mesh = sm
	var cm = StandardMaterial3D.new(); cm.albedo_color = Color(0.85, 0.25, 0.2); cm.cull_mode = BaseMaterial3D.CULL_DISABLED; ch.material_override = cm; ch.position.y = 4.0; crate.add_child(ch)
	var smoke = GPUParticles3D.new(); smoke.amount = 40; smoke.lifetime = 6.0
	var pm = ParticleProcessMaterial.new(); pm.direction = Vector3(0, 1, 0); pm.spread = 12.0; pm.initial_velocity_min = 2.0; pm.initial_velocity_max = 4.0; pm.gravity = Vector3(0.4, 0.6, 0); pm.scale_min = 1.5; pm.scale_max = 4.0; pm.color = Color(0.85, 0.15, 0.12, 0.6)
	smoke.process_material = pm
	var qm = QuadMesh.new(); qm.size = Vector2(1.5, 1.5)
	var sm2 = StandardMaterial3D.new(); sm2.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES; sm2.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; sm2.vertex_color_use_as_albedo = true; sm2.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	qm.material = sm2; smoke.draw_pass_1 = qm
	smoke.position.y = 0.3; crate.add_child(smoke)
	crate.global_position = p + Vector3(0, 320, 0)
	var tw = create_tween()
	tw.tween_property(crate, "global_position", p, 45.0)
	tw.tween_callback(_care_landed.bind(p, base_id, ch))

func _care_landed(p: Vector3, base_id: int, ch: Node3D) -> void:
	ch.visible = false
	var items = ["trovao" if base_id % 20 == 0 else "m9", "vest3", "helmet3", "medkit", "scope8", "ammo:300" if base_id % 20 == 0 else "ammo:556"]
	for k in items.size():
		var it: String = items[k]
		var a = k * TAU / items.size()
		_add_loot(base_id + k, it, _default_amount(it) * (3 if it.begins_with("ammo") else 1), p + Vector3(cos(a) * 1.3, 0.05, sin(a) * 1.3))

# ---------------------------------------------------------------- balas (com queda)
func spawn_bullet(shooter: Soldier, pos: Vector3, vel: Vector3, dmg: float, wid: String, real: bool) -> void:
	var trc: MeshInstance3D = null
	for t in tracer_pool:
		if not t.visible:
			trc = t
			break
	bullets.append({"pos": pos, "vel": vel, "shooter": shooter, "dmg": dmg, "wid": wid, "real": real, "life": 3.0, "tr": trc, "dist": 0.0})
	if trc: trc.visible = true

func _update_bullets(dt: float) -> void:
	if bullets.is_empty(): return
	var space = get_world_3d().direct_space_state
	var keep: Array = []
	for b in bullets:
		var p0: Vector3 = b.pos
		var v: Vector3 = b.vel
		v.y -= 9.8 * dt
		var p1 = p0 + v * dt
		var q = PhysicsRayQueryParameters3D.create(p0, p1, Game.L_WORLD | Game.L_HITBOX)
		q.collide_with_areas = true
		var sh: Soldier = b.shooter
		if is_instance_valid(sh): q.exclude = [sh.get_rid(), sh.hitbox.get_rid()]
		var hit = space.intersect_ray(q)
		var trc: MeshInstance3D = b.tr
		if not hit.is_empty():
			var col = hit.collider
			if col is Area3D and col.get_parent() is Soldier:
				var target = col.get_parent() as Soldier
				_puff(hit.position, true)
				if bool(b.real) and is_instance_valid(sh): _report_hit(sh, target, int(hit.shape), float(b.dmg), String(b.wid))
			else:
				_puff(hit.position, false)
			if trc: trc.visible = false
			continue
		b.pos = p1; b.vel = v; b.life = float(b.life) - dt; b.dist = float(b.dist) + (p1 - p0).length()
		if trc:
			var mid = p0.lerp(p1, 0.5)
			if float(b.dist) > 2.0:
				trc.global_transform = Transform3D(Basis.looking_at(v.normalized(), Vector3.UP if absf(v.normalized().y) < 0.99 else Vector3.RIGHT), mid)
				trc.scale = Vector3(1, 1, minf(14.0, v.length() * dt))
		if float(b.life) > 0.0 and p1.y > -20.0: keep.append(b)
		elif trc: trc.visible = false
	bullets = keep

func _puff(p: Vector3, blood: bool) -> void:
	var mi = MeshInstance3D.new(); var sm = SphereMesh.new(); sm.radius = 0.12; sm.height = 0.24; sm.radial_segments = 6; sm.rings = 3; mi.mesh = sm
	var m = StandardMaterial3D.new(); m.albedo_color = Color(0.6, 0.05, 0.05, 0.9) if blood else Color(0.7, 0.66, 0.55, 0.8); m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mi.material_override = m; mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; add_child(mi); mi.global_position = p
	var tw = create_tween(); tw.tween_property(mi, "scale", Vector3.ONE * 4.0, 0.4); tw.parallel().tween_property(m, "albedo_color:a", 0.0, 0.4); tw.tween_callback(mi.queue_free)

func _report_hit(shooter: Soldier, target: Soldier, part: int, dmg: float, wid: String) -> void:
	if shooter == local: Engine.get_main_loop().root.get_node("Main").hit_marker(part == 0)
	if multiplayer.is_server(): _server_damage(target, part, dmg, shooter, wid)
	else: rpc_req_damage.rpc_id(1, String(target.name), part, dmg, String(shooter.name), wid)

@rpc("any_peer", "reliable")
func rpc_req_damage(target_name: String, part: int, dmg: float, shooter_name: String, wid: String) -> void:
	if not multiplayer.is_server(): return
	var sh = find_soldier(shooter_name); var tg = find_soldier(target_name)
	if sh == null or tg == null or sh.peer_id != multiplayer.get_remote_sender_id(): return
	if not Game.WEAPONS.has(wid) or dmg > float(Game.WEAPONS[wid].dmg) + 0.1: return   # validação básica
	_server_damage(tg, part, dmg, sh, wid)

func _server_damage(target: Soldier, part: int, dmg: float, attacker, wid: String) -> void:
	if not target.alive: return
	if part < 0: target.hp -= dmg          # zona: ignora colete
	else: target.apply_damage(part, dmg, attacker, wid)
	if target.alive and target.hp <= 0.0: on_soldier_killed(target, attacker, wid)
	if target.alive: rpc_hp.rpc(String(target.name), target.hp, String(attacker.name) if attacker != null else "", part < 0)

@rpc("authority", "call_local", "reliable")
func rpc_hp(n: String, hp: float, from: String, zone_dmg: bool) -> void:
	var s = find_soldier(n)
	if s == null: return
	var before = s.hp
	s.hp = hp
	if s == local and hp < before: Engine.get_main_loop().root.get_node("Main").on_hurt(find_soldier(from), zone_dmg)

func sync_health(s: Soldier) -> void:
	if s == local and not multiplayer.is_server(): rpc_gear.rpc_id(1, String(s.name), s.hp, s.boost, s.vest, s.helmet)

@rpc("any_peer", "reliable")
func rpc_gear(n: String, hp: float, boost: float, vest: int, helmet: int) -> void:
	var s = find_soldier(n)
	if s and s.peer_id == multiplayer.get_remote_sender_id():
		s.hp = hp
		s.boost = boost
		s.vest = vest
		s.helmet = helmet

func on_soldier_killed(victim: Soldier, attacker, wid: String) -> void:
	if not multiplayer.is_server() or not victim.alive: return
	var place = alive_count()
	rpc_killed.rpc(String(victim.name), String(attacker.name) if attacker != null and attacker is Soldier else "", wid, place)

@rpc("authority", "call_local", "reliable")
func rpc_killed(vn: String, kn: String, wid: String, place: int) -> void:
	var v = find_soldier(vn); var k = find_soldier(kn)
	if v == null or not v.alive: return
	v.place = place
	var drop_pos = v.global_position
	var inv: Array = []
	if v == local or (v.is_bot and multiplayer.is_server()):
		for w in v.weapons:
			if w != null: inv.append([String(w.id), int(w.mag)])
		for a in v.ammo:
			if int(v.ammo[a]) > 0: inv.append(["ammo:" + a, int(v.ammo[a])])
		for hname in v.heals:
			for i in int(v.heals[hname]): inv.append([hname, 1])
		if v.vest > 0: inv.append(["vest%d" % v.vest, 1])
		if v.helmet > 0: inv.append(["helmet%d" % v.helmet, 1])
	v.hp = 0.0
	v.set_dead()
	if k and k != v: k.kills += 1
	var how = "zona azul" if wid == "zona" else ("bombardeio" if wid == "bombardeio" else ("com " + String(Game.WEAPONS[wid].name) if Game.WEAPONS.has(wid) else wid))
	killfeed.emit(("%s derrubou %s %s" % [k.display_name, v.display_name, how]) if k and k != v else ("%s morreu (%s)" % [v.display_name, how]), v == local or k == local)
	play_sfx("kill", drop_pos)
	for i in inv.size():
		var a = i * 0.9
		drop_item(String(inv[i][0]), drop_pos + Vector3(cos(a) * 0.9, 0.0, sin(a) * 0.9), int(inv[i][1]))
	if v == local: Engine.get_main_loop().root.get_node("Main").on_local_dead(k, place)
	if multiplayer.is_server():
		var alive = []
		for s in soldiers():
			if s.alive: alive.append(s)
		if alive.size() <= 1:
			var w: Soldier = alive[0] if alive.size() == 1 else null
			rpc_end.rpc(String(w.name) if w else "", w.display_name if w else "—", w.kills if w else 0)

@rpc("authority", "call_local", "reliable")
func rpc_end(wn: String, wname: String, kills_n: int) -> void:
	ended = true; phase = "ended"
	match_ended.emit(wn + "|" + wname + "|" + str(kills_n))

# ---------------------------------------------------------------- loot
func _add_loot(id: int, t: String, amount: int, pos: Vector3) -> void:
	if loot.has(id): return
	var node = WeaponModels.build_item(t)
	var ring = MeshInstance3D.new(); var tm = TorusMesh.new(); tm.inner_radius = 0.42; tm.outer_radius = 0.5; tm.rings = 16; tm.ring_segments = 4; ring.mesh = tm
	var rm = StandardMaterial3D.new(); rm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; rm.albedo_color = Color(1.0, 0.85, 0.45, 0.5); rm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	ring.material_override = rm; ring.position.y = 0.03; ring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; node.add_child(ring)
	add_child(node); node.global_position = pos
	node.visibility_range_end = 70.0 if node is GeometryInstance3D else 0.0
	loot[id] = {"id": id, "type": t, "amount": amount, "pos": pos, "node": node}
	next_loot_id = maxi(next_loot_id, id + 1)

func nearest_loot(pos: Vector3, max_d = 2.6):
	var best = null; var bd = max_d
	for id in loot:
		var it: Dictionary = loot[id]
		var d = pos.distance_to(it.pos)
		if d < bd:
			best = it
			bd = d
	return best

func nearest_useful_loot(s: Soldier, radius: float):
	var best = null; var bd = radius
	for id in loot:
		var it: Dictionary = loot[id]
		var d = s.global_position.distance_to(it.pos)
		if d > bd or absf(it.pos.y - s.global_position.y) > 3.0: continue
		var t: String = it.type
		var useful = false
		if Game.WEAPONS.has(t): useful = s.weapons[0] == null and t != "p9"
		elif t.begins_with("ammo:"): useful = s.current_weapon() != null and Game.WEAPONS[s.current_weapon().id].ammo == t.substr(5) and int(s.ammo.get(t.substr(5), 0)) < 120
		elif Game.HEALS.has(t): useful = int(s.heals[t]) < 4
		elif t.begins_with("vest"): useful = int(t.substr(4)) > s.vest
		elif t.begins_with("helmet"): useful = int(t.substr(6)) > s.helmet
		if useful:
			best = it
			bd = d
	return best

func request_pickup(s: Soldier, id: int) -> void:
	if multiplayer.is_server(): _server_pickup(s, id)
	else: rpc_req_pickup.rpc_id(1, String(s.name), id)

@rpc("any_peer", "reliable")
func rpc_req_pickup(n: String, id: int) -> void:
	if not multiplayer.is_server(): return
	var s = find_soldier(n)
	if s and s.peer_id == multiplayer.get_remote_sender_id(): _server_pickup(s, id)

func _server_pickup(s: Soldier, id: int) -> void:
	if not loot.has(id) or not s.alive: return
	var it: Dictionary = loot[id]
	if s.global_position.distance_to(it.pos) > 4.0: return
	rpc_remove_loot.rpc(id, String(s.name))

@rpc("authority", "call_local", "reliable")
func rpc_remove_loot(id: int, picker: String) -> void:
	if not loot.has(id): return
	var it: Dictionary = loot[id]
	loot.erase(id)
	(it.node as Node).queue_free()
	var s = find_soldier(picker)
	if s and (s == local or (s.is_bot and multiplayer.is_server())):
		var ok = s.give(String(it.type), int(it.amount))
		if not ok: drop_item(String(it.type), s.global_position, int(it.amount))
		elif s == local: play_sfx("pickup", s.global_position)
		if s == local: sync_health(s)

func drop_item(t: String, pos: Vector3, amount: int) -> void:
	if multiplayer.is_server():
		var id = next_loot_id; next_loot_id += 1
		rpc_spawn_loot.rpc(id, t, amount, pos + Vector3(0, 0.05, 0))
	else: rpc_req_drop.rpc_id(1, t, pos, amount)

@rpc("any_peer", "reliable")
func rpc_req_drop(t: String, pos: Vector3, amount: int) -> void:
	if multiplayer.is_server(): drop_item(t, pos, amount)

@rpc("authority", "call_local", "reliable")
func rpc_spawn_loot(id: int, t: String, amount: int, pos: Vector3) -> void:
	_add_loot(id, t, amount, pos)

# ---------------------------------------------------------------- rede: estado
@rpc("any_peer", "unreliable_ordered")
func rpc_state(n: String, pos: Vector3, y: float, p: float, st: String, stance: int, wid: String, vis: bool) -> void:
	var s = find_soldier(n)
	if s == null or s == local or s.peer_id != multiplayer.get_remote_sender_id(): return
	s.net_pos = pos; s.net_yaw = y; s.net_pitch = p; s.visible = vis
	if s.alive and st != "dead": s.state = st
	if s.stance != stance:
		s.stance = stance
		s._update_hitbox()
	if _wid(s) != wid:
		s.weapons[0] = {"id": wid, "mag": 1, "scope": 1.0} if wid != "" else null; s.cur = 0 if wid != "" else -1; s.set_weapon_visual()

func _send_bots() -> void:
	var data: Array = []
	for s in soldiers():
		if s.is_bot: data.append([String(s.name), s.global_position, s.yaw, s.pitch, s.state, s.stance, _wid(s), s.visible])
	rpc_bots.rpc(data)

@rpc("authority", "unreliable_ordered")
func rpc_bots(data: Array) -> void:
	for d in data:
		var s = find_soldier(String(d[0]))
		if s == null: continue
		s.net_pos = d[1]; s.net_yaw = d[2]; s.net_pitch = d[3]; s.visible = d[7]
		if s.alive and String(d[4]) != "dead": s.state = d[4]
		if s.stance != int(d[5]):
			s.stance = int(d[5])
			s._update_hitbox()
		if _wid(s) != String(d[6]):
			s.weapons[0] = {"id": d[6], "mag": 1, "scope": 1.0} if String(d[6]) != "" else null; s.cur = 0 if String(d[6]) != "" else -1; s.set_weapon_visual()

@rpc("authority", "unreliable")
func rpc_time(t: float) -> void:
	if absf(t - time) > 0.5: time = t

# tiros visuais dos outros jogadores
func net_fire(s: Soldier, pos: Vector3, vel: Vector3, wid: String) -> void:
	if multiplayer.multiplayer_peer is OfflineMultiplayerPeer: return
	if s == local or (s.is_bot and multiplayer.is_server()): rpc_fire.rpc(String(s.name), pos, vel, wid)

@rpc("any_peer", "unreliable")
func rpc_fire(n: String, pos: Vector3, vel: Vector3, wid: String) -> void:
	var s = find_soldier(n)
	if s == null: return
	spawn_bullet(s, pos, vel, 0.0, wid, false)
	play_sfx(wid, pos)

# ---------------------------------------------------------------- som (sintetizado)
func _make_sfx() -> void:
	sfx["rifle"] = _noise_burst(0.32, 2600.0, 0.9)
	sfx["pistol"] = _noise_burst(0.2, 3400.0, 0.7)
	sfx["shotgun"] = _noise_burst(0.5, 1500.0, 1.0)
	sfx["sniper"] = _noise_burst(0.7, 2200.0, 1.0)
	sfx["bomb"] = _noise_burst(1.6, 500.0, 1.0)
	sfx["click"] = _noise_burst(0.04, 6000.0, 0.4)
	for i in 24:
		var p = AudioStreamPlayer3D.new(); p.max_distance = 900.0; p.unit_size = 12.0; p.attenuation_model = AudioStreamPlayer3D.ATTENUATION_LOGARITHMIC
		add_child(p); sfx_pool.append(p)

func _noise_burst(len_s: float, cutoff: float, vol: float) -> AudioStreamWAV:
	var rate = 22050
	var n = int(len_s * rate)
	var data = PackedByteArray(); data.resize(n * 2)
	var a = clampf(cutoff / rate * 2.0 * PI, 0.01, 1.0)
	var y = 0.0
	var r = RandomNumberGenerator.new(); r.seed = int(cutoff)
	for i in n:
		var t = float(i) / n
		var env = pow(1.0 - t, 3.0) * (1.0 if i > 30 else float(i) / 30.0)
		y += a * (r.randf_range(-1, 1) - y)
		var low = sin(i * 2.0 * PI * 70.0 / rate * (1.0 - t)) * pow(1.0 - t, 6.0) * 0.6
		var v = clampf((y * 2.2 + low) * env * vol, -1.0, 1.0)
		data.encode_s16(i * 2, int(v * 32000.0))
	var w = AudioStreamWAV.new(); w.format = AudioStreamWAV.FORMAT_16_BITS; w.mix_rate = rate; w.stereo = false; w.data = data
	return w

func play_sfx(kind: String, pos: Vector3) -> void:
	var key = kind
	if Game.WEAPONS.has(kind):
		key = "pistol" if kind in ["p9", "vespa"] else ("shotgun" if kind == "t12" else ("sniper" if kind in ["falcao", "trovao", "lince"] else "rifle"))
	if not sfx.has(key): key = "click"
	for p in sfx_pool:
		if not p.playing:
			p.stream = sfx[key]; p.global_position = pos
			p.volume_db = linear_to_db(maxf(0.001, float(Game.settings["volume"])))
			p.pitch_scale = Game.rng.randf_range(0.93, 1.07)
			p.play(); return

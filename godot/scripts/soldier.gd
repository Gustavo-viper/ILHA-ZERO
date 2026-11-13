extends CharacterBody3D
class_name Soldier
## Soldado: jogador local, bot (IA, roda no host) ou "marionete" (outro jogador na rede).

const SOLDIER_SCENE = "res://assets/characters/soldier.glb"
const TINTS = [Color(1, 1, 1), Color(0.75, 0.82, 0.62), Color(0.88, 0.80, 0.64), Color(0.68, 0.74, 0.84), Color(0.6, 0.6, 0.56), Color(0.85, 0.7, 0.58)]

var match_ref
var world
var display_name = ""
var is_bot = false
var is_local = false
var is_puppet = false
var peer_id = 1
var skill = 0.6

# estado
var hp = 100.0
var boost = 0.0
var alive = true
var state = "lobby"          # lobby, plane, air, chute, ground, dead
var stance = 0               # 0 em pé, 1 agachado, 2 deitado
var lean = 0.0
var yaw = 0.0
var pitch = 0.0
var aiming = false
var sprinting = false
var move_speed = 0.0

# inventário
var weapons: Array = [null, null, null]   # {id, mag, scope, extmag, comp}
var cur = -1
var ammo = {"9mm": 0, "556": 0, "762": 0, "12g": 0, "300": 0}
var heals = {"bandage": 0, "firstaid": 0, "medkit": 0, "drink": 0, "pills": 0}
var spare = {}               # acessórios ainda não encaixados
var vest = 0
var helmet = 0
var pack = 0
var kills = 0
var place = 0

# ações (recarregar / curar)
var action = ""
var action_t = 0.0
var action_total = 0.0
var fire_cd = 0.0
var auto_fire = true
var recoil = 0.0

# visual
var model: Node3D
var body_pivot: Node3D
var anim: AnimationPlayer
var anim_cur = ""
var hand: Node3D
var gun: Node3D
var chute: Node3D
var hitbox: Area3D
var shape_head: CollisionShape3D
var shape_torso: CollisionShape3D
var shape_legs: CollisionShape3D
var capsule: CollisionShape3D

# câmera (só jogador local)
var cam_pivot: Node3D
var spring: SpringArm3D
var cam: Camera3D
var first_person = false
var freelook = false
var look_yaw = 0.0
var look_pitch = 0.0
var spectate = null

# rede (marionete)
var net_pos = Vector3.ZERO
var net_yaw = 0.0
var net_pitch = 0.0

# IA
var ai = {"target": null, "goal": null, "think": 0.0, "react": 0.0, "stuck": 0.0, "avoid": 0.0, "avoid_dir": 1.0, "strafe": 1.0, "strafe_t": 0.0, "jump_at": 0.5, "last_pos": Vector3.ZERO, "can_see": false}

func setup(m: Node, w: Node, name_in: String, bot: bool, local: bool, seed_tint: int) -> void:
	match_ref = m; world = w; display_name = name_in; is_bot = bot; is_local = local; is_puppet = not bot and not local
	collision_layer = Game.L_BODY
	collision_mask = Game.L_WORLD
	floor_snap_length = 0.4
	floor_max_angle = deg_to_rad(50)
	capsule = CollisionShape3D.new()
	var cap = CapsuleShape3D.new(); cap.radius = 0.35; cap.height = 1.8
	capsule.shape = cap; capsule.position.y = 0.9
	add_child(capsule)
	_build_hitbox()
	_build_model(seed_tint)
	if is_local: _build_camera()
	skill = Game.rng.randf_range(0.35, 0.9)
	ai["jump_at"] = Game.rng.randf_range(0.1, 0.85)

func _build_hitbox() -> void:
	hitbox = Area3D.new(); hitbox.collision_layer = Game.L_HITBOX; hitbox.collision_mask = 0; hitbox.monitoring = false
	shape_head = CollisionShape3D.new(); var sh = SphereShape3D.new(); sh.radius = 0.16; shape_head.shape = sh
	shape_torso = CollisionShape3D.new(); var st = CapsuleShape3D.new(); st.radius = 0.24; st.height = 0.75; shape_torso.shape = st
	shape_legs = CollisionShape3D.new(); var sl = CapsuleShape3D.new(); sl.radius = 0.2; sl.height = 0.9; shape_legs.shape = sl
	hitbox.add_child(shape_head); hitbox.add_child(shape_torso); hitbox.add_child(shape_legs)   # índices 0,1,2
	add_child(hitbox)
	_update_hitbox()

func _update_hitbox() -> void:
	if stance == 2 or state == "dead":
		shape_head.position = Vector3(0, 0.25, -0.75); shape_torso.position = Vector3(0, 0.22, 0); shape_torso.rotation = Vector3(PI / 2, 0, 0)
		shape_legs.position = Vector3(0, 0.2, 0.75); shape_legs.rotation = Vector3(PI / 2, 0, 0)
	else:
		var k = 0.72 if stance == 1 else 1.0
		shape_head.position = Vector3(0, 1.62 * k, 0); shape_torso.position = Vector3(0, 1.15 * k, 0); shape_torso.rotation = Vector3.ZERO
		shape_legs.position = Vector3(0, 0.48 * k, 0); shape_legs.rotation = Vector3.ZERO
	var cap = capsule.shape as CapsuleShape3D
	cap.height = 1.8 if stance == 0 else (1.3 if stance == 1 else 0.7)
	capsule.position.y = cap.height * 0.5

func _build_model(seed_tint: int) -> void:
	body_pivot = Node3D.new(); add_child(body_pivot)
	var ps = load(SOLDIER_SCENE) as PackedScene
	if ps:
		model = ps.instantiate()
		body_pivot.add_child(model)
		var tint: Color = TINTS[absi(seed_tint) % TINTS.size()]
		for mi in model.find_children("*", "MeshInstance3D", true, false):
			var m = mi as MeshInstance3D
			m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
			for s in m.get_surface_override_material_count():
				var base = m.mesh.surface_get_material(s)
				if base is StandardMaterial3D and not String(base.resource_name).to_lower().contains("visor"):
					var c = (base as StandardMaterial3D).duplicate() as StandardMaterial3D
					c.albedo_color = tint
					m.set_surface_override_material(s, c)
		var aps = model.find_children("*", "AnimationPlayer", true, false)
		if aps.size() > 0:
			anim = aps[0] as AnimationPlayer
			for a in ["Idle", "Walk", "Run"]:
				if anim.has_animation(a): anim.get_animation(a).loop_mode = Animation.LOOP_LINEAR
			_play("Idle", 0.0)
			anim.seek(Game.rng.randf() * 1.5, true)
		var sks = model.find_children("*", "Skeleton3D", true, false)
		if sks.size() > 0:
			var sk = sks[0] as Skeleton3D
			for b in sk.get_bone_count():
				if sk.get_bone_name(b).ends_with("RightHand"):
					var att = BoneAttachment3D.new(); att.bone_name = sk.get_bone_name(b); sk.add_child(att); hand = att
					break
	else:
		# reserva: boneco simples se o modelo não carregar
		var mi2 = MeshInstance3D.new(); var cm = CapsuleMesh.new(); cm.radius = 0.3; cm.height = 1.8; mi2.mesh = cm; mi2.position.y = 0.9
		body_pivot.add_child(mi2)
	gun = Node3D.new(); add_child(gun)
	chute = _make_chute(); chute.visible = false; add_child(chute)

func _make_chute() -> Node3D:
	var n = Node3D.new()
	var sm = SphereMesh.new(); sm.radius = 3.4; sm.height = 2.6; sm.is_hemisphere = true; sm.radial_segments = 16; sm.rings = 6
	var mat = StandardMaterial3D.new(); mat.albedo_color = Color(0.25, 0.38, 0.55); mat.cull_mode = BaseMaterial3D.CULL_DISABLED; mat.roughness = 0.8
	var c = MeshInstance3D.new(); c.mesh = sm; c.material_override = mat; c.position.y = 4.4; c.scale = Vector3(1.25, 0.6, 0.9)
	n.add_child(c)
	var lm = StandardMaterial3D.new(); lm.albedo_color = Color(0.9, 0.9, 0.9)
	for p in [Vector3(-3.4, 4.4, -1.4), Vector3(3.4, 4.4, -1.4), Vector3(-3.4, 4.4, 1.4), Vector3(3.4, 4.4, 1.4)]:
		var cyl = CylinderMesh.new(); cyl.top_radius = 0.012; cyl.bottom_radius = 0.012; cyl.height = p.length(); cyl.radial_segments = 4
		var l = MeshInstance3D.new(); l.mesh = cyl; l.material_override = lm
		l.position = p * 0.5 + Vector3(0, 1.0, 0)
		l.basis = Basis(Quaternion(Vector3.UP, p.normalized()))
		n.add_child(l)
	return n

func set_weapon_visual() -> void:
	for c in gun.get_children(): c.queue_free()
	var w = current_weapon()
	if w == null: return
	gun.add_child(WeaponModels.build(String(w.id), bool(w.get("scope", 1.0) > 1.0)))

func _play(a: String, blend = 0.25) -> void:
	if anim == null or anim_cur == a or not anim.has_animation(a): return
	anim_cur = a; anim.play(a, blend)

# ---------------------------------------------------------------- câmera
func _build_camera() -> void:
	cam_pivot = Node3D.new(); add_child(cam_pivot)
	spring = SpringArm3D.new(); spring.spring_length = 3.2; spring.collision_mask = Game.L_WORLD; spring.margin = 0.2
	var sph = SphereShape3D.new(); sph.radius = 0.25; spring.shape = sph
	spring.add_excluded_object(get_rid())
	cam_pivot.add_child(spring)
	cam = Camera3D.new(); cam.fov = float(Game.settings["fov"]); cam.near = 0.05; cam.far = 2500.0
	spring.add_child(cam)
	cam.make_current()

func _update_camera(dt: float) -> void:
	if cam_pivot == null: return
	var scope = scope_zoom()
	if not alive:
		# espectador: orbita o jogador observado (ou o próprio corpo)
		var tgt = spectate if spectate != null and is_instance_valid(spectate) and spectate.alive else self
		cam_pivot.global_position = tgt.global_position + Vector3(0, 1.7, 0)
		cam_pivot.rotation = Vector3(look_pitch, look_yaw, 0)
		spring.spring_length = lerpf(spring.spring_length, 4.5, minf(1.0, dt * 6.0))
		cam.fov = lerpf(cam.fov, float(Game.settings["fov"]), minf(1.0, dt * 8.0))
		if model: model.visible = true
		return
	var eye_h = 1.6 if stance == 0 else (1.15 if stance == 1 else 0.45)
	if state == "plane":
		cam_pivot.global_position = global_position + Vector3(0, 6, 0)
		spring.spring_length = 32.0; cam_pivot.rotation = Vector3(look_pitch, look_yaw, 0)
		cam.fov = lerpf(cam.fov, float(Game.settings["fov"]), dt * 10.0)
		return
	var y = yaw if not freelook else look_yaw
	var p = pitch if not freelook else look_pitch
	var air = state == "air" or state == "chute"
	var fp = (first_person or (aiming and scope > 1.0)) and not air and alive
	var side = 0.0 if fp or air else 0.55 + lean * 0.4
	var target_len = 0.0 if fp else (7.5 if air else (1.5 if aiming else 3.2))
	spring.spring_length = lerpf(spring.spring_length, target_len, minf(1.0, dt * 12.0))
	var base = global_position + Vector3(0, eye_h, 0)
	var right = Vector3(cos(y), 0, -sin(y))
	cam_pivot.global_position = base + right * (side + lean * 0.35)
	cam_pivot.rotation = Vector3(p, y, lean * -0.18)
	var fov_base = float(Game.settings["fov"])
	var target_fov = fov_base / scope if (aiming and scope > 1.0) else (fov_base * 0.78 if aiming else fov_base)
	cam.fov = lerpf(cam.fov, target_fov, minf(1.0, dt * 14.0))
	if model: model.visible = not fp

# ---------------------------------------------------------------- inventário
func current_weapon():
	return weapons[cur] if cur >= 0 and cur < 3 else null

func weapon_def() -> Dictionary:
	var w = current_weapon()
	return Game.WEAPONS[w.id] if w != null else {}

func mag_size(w) -> int:
	var d: Dictionary = Game.WEAPONS[w.id]
	return int(d.mag * (1.5 if w.get("extmag", false) else 1.0))

func scope_zoom() -> float:
	var w = current_weapon()
	if w == null: return 1.0
	return float(w.get("scope", Game.WEAPONS[w.id].scope))

func give(item: String, amount = -1) -> bool:
	if Game.WEAPONS.has(item):
		var d: Dictionary = Game.WEAPONS[item]
		var w = {"id": item, "mag": amount if amount >= 0 else int(d.mag), "scope": float(d.scope), "extmag": false, "comp": false}
		var slot = int(d.slot)
		if slot == 0:
			slot = 0 if weapons[0] == null else (1 if weapons[1] == null else (cur if cur in [0, 1] else 0))
		var old = weapons[slot]
		weapons[slot] = w
		_apply_spare_attachments(w)
		cur = slot
		set_weapon_visual()
		if old != null and match_ref: match_ref.drop_item(String(old.id), global_position, int(old.mag))
		return true
	if item.begins_with("ammo:"):
		var t = item.substr(5)
		ammo[t] = int(ammo.get(t, 0)) + (amount if amount > 0 else int(Game.AMMO.get(t, 30)))
		return true
	if heals.has(item):
		heals[item] = int(heals[item]) + 1
		return true
	if Game.ATTACH.has(item):
		spare[item] = true
		for w in weapons:
			if w != null: _apply_spare_attachments(w)
		return true
	for kind in ["vest", "helmet", "pack"]:
		if item.begins_with(kind):
			var lv = int(item.substr(kind.length()))
			var curv: int = get(kind)
			if lv <= curv: return false
			if curv > 0 and match_ref: match_ref.drop_item(kind + str(curv), global_position, 1)
			set(kind, lv); return true
	return false

func _apply_spare_attachments(w: Dictionary) -> void:
	var d: Dictionary = Game.WEAPONS[w.id]
	if int(d.slot) != 0: return
	var can_scope = w.id in ["ar7", "m12", "lince", "falcao", "trovao", "m9", "vespa"]
	for s in [["scope8", 8.0], ["scope4", 4.0], ["scope2", 2.0]]:
		if spare.has(s[0]) and can_scope and float(w.scope) < float(s[1]):
			w.scope = float(s[1]); spare.erase(s[0]); break
	if spare.has("extmag") and not w.extmag and w.id != "t12":
		w.extmag = true
		spare.erase("extmag")
	if spare.has("comp") and not w.comp and w.id != "t12":
		w.comp = true
		spare.erase("comp")

# ---------------------------------------------------------------- ações
func start_reload() -> void:
	var w = current_weapon()
	if w == null or action != "" or not alive: return
	var d: Dictionary = Game.WEAPONS[w.id]
	if int(w.mag) >= mag_size(w) or int(ammo.get(d.ammo, 0)) <= 0: return
	action = "reload"; action_total = float(d.reload); action_t = action_total
	if match_ref: match_ref.play_sfx("reload", global_position)

func start_heal(item: String) -> void:
	if not alive or state != "ground" or action != "" or int(heals.get(item, 0)) <= 0: return
	var d: Dictionary = Game.HEALS[item]
	if float(d.add) > 0.0 and hp >= float(d.cap): return
	action = item; action_total = float(d.time); action_t = action_total

func _finish_action() -> void:
	var a = action; action = ""
	if a == "reload":
		var w = current_weapon()
		if w == null: return
		var t: String = Game.WEAPONS[w.id].ammo
		var need = mag_size(w) - int(w.mag)
		var n = mini(need, int(ammo.get(t, 0)))
		w.mag = int(w.mag) + n; ammo[t] = int(ammo[t]) - n
	elif Game.HEALS.has(a):
		var d: Dictionary = Game.HEALS[a]
		heals[a] = int(heals[a]) - 1
		if a == "bandage": hp = maxf(hp, minf(float(d.cap), hp + float(d.add)))
		elif float(d.add) > 0.0: hp = maxf(hp, float(d.cap))
		boost = minf(100.0, boost + float(d.boost))
		if match_ref: match_ref.sync_health(self)

# ---------------------------------------------------------------- tiro
func can_fire() -> bool:
	var w = current_weapon()
	return alive and w != null and fire_cd <= 0.0 and state in ["ground", "lobby"] and action != "reload" and int(w.mag) > 0

func fire(aim_point: Vector3) -> void:
	var w = current_weapon()
	if w == null: return
	if int(w.mag) <= 0:
		start_reload()
		return
	var d: Dictionary = Game.WEAPONS[w.id]
	if action != "" and action != "reload": action = ""   # atirar cancela a cura
	fire_cd = 60.0 / float(d.rpm)
	w.mag = int(w.mag) - 1
	var muzzle = muzzle_position()
	var dir = (aim_point - muzzle).normalized()
	var spread = float(d.ads) if aiming else float(d.hip)
	if move_speed > 0.8: spread += 0.012
	if stance == 1: spread *= 0.8
	elif stance == 2: spread *= 0.6
	if state != "ground" and state != "lobby": spread += 0.04
	for i in int(d.pellets):
		var dd = (dir + Vector3(Game.rng.randfn(0, spread), Game.rng.randfn(0, spread), Game.rng.randfn(0, spread))).normalized()
		match_ref.spawn_bullet(self, muzzle, dd * float(d.vel), float(d.dmg), String(w.id), true)
	match_ref.net_fire(self, muzzle, dir * float(d.vel), String(w.id))
	var k = float(d.recoil) * (0.65 if w.get("comp", false) else 1.0) * (0.75 if stance > 0 else 1.0) * (0.8 if aiming else 1.0)
	recoil += k
	pitch = clampf(pitch + k, -1.45, 1.45)
	yaw += Game.rng.randf_range(-0.4, 0.4) * k
	match_ref.play_sfx(String(w.id), muzzle)

func muzzle_position() -> Vector3:
	var fwd = -Basis(Vector3.UP, yaw).z
	var h = 1.45 if stance == 0 else (1.0 if stance == 1 else 0.35)
	return global_position + Vector3(0, h, 0) + fwd * 0.6 + Basis(Vector3.UP, yaw).x * 0.18

# ---------------------------------------------------------------- dano (só o host decide)
func apply_damage(part: int, dmg: float, attacker: Node, weapon: String) -> float:
	if not alive: return 0.0
	var amount = dmg
	if part == 0: amount *= 2.35 * (1.0 - Game.HELMET_RED[helmet])
	elif part == 1: amount *= 1.0 - Game.ARMOR_RED[vest]
	else: amount *= 0.9
	hp -= amount
	if is_bot and attacker != null and attacker != self and ai.target == null:
		ai["target"] = attacker; ai["react"] = 0.25
	return amount

func set_dead() -> void:
	look_yaw = yaw; look_pitch = -0.3
	alive = false; state = "dead"; action = ""
	capsule.disabled = true
	hitbox.monitorable = false
	hitbox.collision_layer = 0
	_update_hitbox()
	_play("Idle", 0.2)

# ---------------------------------------------------------------- física / movimento
func _physics_process(dt: float) -> void:
	if is_puppet:
		_puppet_step(dt); return
	if is_bot and not multiplayer.is_server():
		_puppet_step(dt)
		return
	fire_cd -= dt
	recoil = maxf(0.0, recoil - dt * 0.15)
	if action != "":
		action_t -= dt
		if action_t <= 0.0: _finish_action()
	if alive and boost > 0.0:
		boost = maxf(0.0, boost - dt * 0.45)
		hp = minf(100.0, hp + dt * (boost / 60.0))
	match state:
		"plane", "dead":
			velocity = Vector3.ZERO
		"air", "chute":
			_air_step(dt)
		_:
			if is_bot: _bot_step(dt)
			elif is_local: _local_step(dt)

func wish_from_input() -> Vector3:
	var iv = Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var b = Basis(Vector3.UP, yaw)
	return (b.x * iv.x + b.z * iv.y).normalized() if iv.length() > 0.05 else Vector3.ZERO

func _local_step(dt: float) -> void:
	var wish = wish_from_input()
	sprinting = Input.is_action_pressed("sprint") and Input.is_action_pressed("move_forward") and not aiming and stance != 2
	if sprinting and stance == 1:
		stance = 0
		_update_hitbox()
	if Input.is_action_just_pressed("jump") and is_on_floor():
		if stance > 0:
			stance = 0
			_update_hitbox()
		else: velocity.y = 5.2
	lean = move_toward(lean, (-1.0 if Input.is_action_pressed("lean_left") else 0.0) + (1.0 if Input.is_action_pressed("lean_right") else 0.0), dt * 6.0)
	_ground_move(dt, wish, sprinting)

func _ground_move(dt: float, wish: Vector3, sprint: bool) -> void:
	var speed = 4.7
	if stance == 1: speed = 2.6
	elif stance == 2: speed = 1.1
	if sprint and stance == 0: speed = 6.3
	if aiming: speed = minf(speed, 2.6)
	if action != "" and action != "reload": speed = minf(speed, 1.4)
	if boost >= 60.0: speed *= 1.06
	var swimming = global_position.y < Game.WATER_LEVEL - 1.0
	if swimming: speed = 2.4
	var target = wish * speed
	var acc = 14.0 if is_on_floor() else 3.0
	velocity.x = lerpf(velocity.x, target.x, minf(1.0, dt * acc))
	velocity.z = lerpf(velocity.z, target.z, minf(1.0, dt * acc))
	if swimming:
		velocity.y = lerpf(velocity.y, (Game.WATER_LEVEL - 1.2 - global_position.y) * 3.0, minf(1.0, dt * 5.0))
	elif not is_on_floor():
		velocity.y -= 9.8 * dt
	move_and_slide()
	move_speed = Vector2(velocity.x, velocity.z).length()
	if global_position.y < -30.0: global_position.y = world.height_at(global_position.x, global_position.z) + 2.0
	var lim = Game.HALF - 3.0
	global_position.x = clampf(global_position.x, -lim, lim); global_position.z = clampf(global_position.z, -lim, lim)

func _air_step(dt: float) -> void:
	var wish = Vector3.ZERO
	var dive = false
	if is_local:
		wish = wish_from_input(); dive = Input.is_action_pressed("move_forward")
	elif is_bot and ai.goal != null:
		var g: Vector3 = ai.goal
		var to = Vector3(g.x - global_position.x, 0, g.z - global_position.z)
		if to.length() > 3.0: wish = to.normalized()
		yaw = atan2(-to.x, -to.z)
		dive = state == "air"
	var agl: float = global_position.y - world.height_at(global_position.x, global_position.z)
	if state == "air" and agl < 140.0: open_chute()
	var hs = 13.0 if state == "chute" else 24.0
	var vs = (-7.0 if dive else -5.0) if state == "chute" else (-52.0 if dive else -40.0)
	velocity.x = lerpf(velocity.x, wish.x * hs, minf(1.0, dt * 1.5))
	velocity.z = lerpf(velocity.z, wish.z * hs, minf(1.0, dt * 1.5))
	velocity.y = lerpf(velocity.y, vs, minf(1.0, dt * 2.0))
	move_and_slide()
	move_speed = 0.0
	if is_on_floor() or global_position.y < Game.WATER_LEVEL - 0.8 or agl < 0.3:
		state = "ground"; chute.visible = false; velocity = Vector3.ZERO
		if is_bot: ai["goal"] = null

func open_chute() -> void:
	if state == "air":
		state = "chute"; chute.visible = true
		if match_ref: match_ref.play_sfx("chute", global_position)

func jump_from_plane(pos: Vector3) -> void:
	if state != "plane": return
	global_position = pos + Vector3(0, -6, 0)
	velocity = Vector3.ZERO
	state = "air"
	visible = true

# ---------------------------------------------------------------- marionete (rede)
func _puppet_step(dt: float) -> void:
	var k = minf(1.0, dt * 12.0)
	var prev = global_position
	if global_position.distance_to(net_pos) > 30.0: global_position = net_pos
	else: global_position = global_position.lerp(net_pos, k)
	yaw = lerp_angle(yaw, net_yaw, k); pitch = lerpf(pitch, net_pitch, k)
	move_speed = Vector2(global_position.x - prev.x, global_position.z - prev.z).length() / maxf(dt, 0.0001)
	chute.visible = state == "chute"

# ---------------------------------------------------------------- visual por quadro
func _process(dt: float) -> void:
	rotation.y = yaw if not (is_local and freelook) else rotation.y
	if is_local:
		_update_camera(dt)
	# animação
	if body_pivot:
		body_pivot.rotation = Vector3.ZERO; body_pivot.position = Vector3.ZERO; body_pivot.scale = Vector3.ONE
		if state == "dead":
			body_pivot.rotation.x = PI / 2.0; body_pivot.position.y = 0.2
		elif state == "air":
			body_pivot.rotation.x = -1.2; body_pivot.position.y = 1.0
		elif stance == 2:
			body_pivot.rotation.x = -PI / 2.0 * 0.95; body_pivot.position = Vector3(0, 0.25, 0.4)
		elif stance == 1:
			body_pivot.scale = Vector3(1, 0.74, 1)
		body_pivot.rotation.z = -lean * 0.25
	var a = "Idle"
	if state == "ground" or state == "lobby":
		if move_speed > 5.4: a = "Run"
		elif move_speed > 0.5: a = "Walk"
	_play(a)
	if anim:
		anim.speed_scale = clampf(move_speed / (6.0 if a == "Run" else 2.2), 0.6, 1.5) if a != "Idle" else 1.0
		if stance == 2 and a == "Walk": anim.speed_scale *= 0.5
	# arma: segue a mão; aponta para a mira (abaixada quando relaxado)
	if gun:
		var w = current_weapon()
		gun.visible = w != null and alive and state in ["ground", "lobby"]
		if gun.visible:
			var ready = aiming or fire_cd > -1.2 or is_puppet or is_bot
			var b = Basis.from_euler(Vector3(pitch if ready else pitch - 0.7, yaw, 0.0), EULER_ORDER_YXZ)
			var p: Vector3 = hand.global_position if hand else muzzle_position() - (-Basis(Vector3.UP, yaw).z) * 0.6
			gun.global_transform = Transform3D(b, p)

# ---------------------------------------------------------------- IA dos bots (roda no host)
func _bot_step(dt: float) -> void:
	ai["think"] = float(ai.think) - dt
	if float(ai.think) <= 0.0:
		ai["think"] = Game.rng.randf_range(0.25, 0.4)
		_bot_think()
	var wish = Vector3.ZERO
	var sprint = false
	aiming = false
	var tgt = ai.target
	if tgt != null and is_instance_valid(tgt) and tgt.alive and bool(ai.can_see):
		var to: Vector3 = tgt.global_position - global_position
		var flat = Vector3(to.x, 0, to.z)
		var dist = flat.length()
		yaw = lerp_angle(yaw, atan2(-to.x, -to.z), minf(1.0, dt * 6.0))
		pitch = atan2(to.y + 0.2, maxf(dist, 0.1))
		ai["strafe_t"] = float(ai.strafe_t) - dt
		if float(ai.strafe_t) <= 0.0:
			ai["strafe"] = -float(ai.strafe)
			ai["strafe_t"] = Game.rng.randf_range(0.6, 1.8)
		var d = weapon_def()
		var want: float = minf(float(d.get("vel", 400.0)) / 20.0, 40.0) if not d.is_empty() else 0.0
		var fwd = flat.normalized()
		var side = Vector3(-fwd.z, 0, fwd.x)
		wish = (fwd * (1.0 if dist > want else (-0.5 if dist < want * 0.5 else 0.0)) + side * float(ai.strafe) * 0.8).normalized()
		aiming = true
		ai["react"] = float(ai.react) - dt
		var w = current_weapon()
		if w != null and float(ai.react) <= 0.0 and can_fire():
			var err = (0.04 + (1.0 - skill) * 0.09 + (0.03 if tgt.move_speed > 1.0 else 0.0)) * (1.0 + dist / 120.0)
			var aim_y = 1.55 if Game.rng.randf() < 0.12 * skill else 1.1
			var aim: Vector3 = tgt.global_position + Vector3(0, aim_y if tgt.stance == 0 else 0.4, 0) + Vector3(Game.rng.randfn(0, err), Game.rng.randfn(0, err), Game.rng.randfn(0, err)) * dist
			fire(aim)
			var dd: Dictionary = Game.WEAPONS[w.id]
			fire_cd *= 1.6 if bool(dd.auto) else 1.15
			if not bool(dd.auto): ai["react"] = Game.rng.randf_range(0.2, 0.6) * (1.6 - skill)
		if w != null and int(w.mag) == 0: start_reload()
	elif ai.goal != null:
		var g: Vector3 = ai.goal
		var to2 = Vector3(g.x - global_position.x, 0, g.z - global_position.z)
		if to2.length() < 1.3:
			if ai.has("loot_id") and ai.loot_id >= 0 and match_ref: match_ref.request_pickup(self, int(ai.loot_id))
			ai["goal"] = null; ai["loot_id"] = -1
		else:
			wish = to2.normalized(); yaw = lerp_angle(yaw, atan2(-to2.x, -to2.z), minf(1.0, dt * 5.0)); pitch = 0.0
			var z: Dictionary = match_ref.zone
			if Vector2(global_position.x, global_position.z).distance_to(z.c) > float(z.r) * 0.9: sprint = true
	# desvio de obstáculos
	if float(ai.avoid) > 0.0:
		ai["avoid"] = float(ai.avoid) - dt
		wish = wish.rotated(Vector3.UP, float(ai.avoid_dir) * 1.1)
	_ground_move(dt, wish, sprint)
	if wish.length() > 0.1:
		var moved = global_position.distance_to(ai.last_pos)
		if moved < 0.6 * dt * 4.0:
			ai["stuck"] = float(ai.stuck) + dt
			if float(ai.stuck) > 0.5:
				ai["avoid"] = Game.rng.randf_range(0.8, 1.6); ai["avoid_dir"] = 1.0 if Game.rng.randf() < 0.5 else -1.0; ai["stuck"] = 0.0
				if is_on_floor(): velocity.y = 5.0
		else: ai["stuck"] = maxf(0.0, float(ai.stuck) - dt)
	ai["last_pos"] = global_position
	if action == "" and hp < 60.0 and not bool(ai.can_see):
		for hname in ["medkit", "firstaid", "bandage", "pills", "drink"]:
			if int(heals[hname]) > 0:
				start_heal(hname)
				break

func _bot_think() -> void:
	ai["can_see"] = false
	var eye = global_position + Vector3(0, 1.55, 0)
	var best = null; var bd = 160.0 + skill * 60.0
	for s in match_ref.soldiers():
		if s == self or not s.alive or s.state != "ground": continue
		var d = global_position.distance_to(s.global_position)
		if d < bd:
			best = s
			bd = d
	if best != null and current_weapon() != null:
		var q = PhysicsRayQueryParameters3D.create(eye, best.global_position + Vector3(0, 1.2, 0), Game.L_WORLD)
		if get_world_3d().direct_space_state.intersect_ray(q).is_empty():
			if ai.target != best: ai["react"] = Game.rng.randf_range(0.35, 0.9) * (1.5 - skill)
			ai["target"] = best; ai["can_see"] = true; ai["goal"] = null
			return
	if ai.target != null and (not is_instance_valid(ai.target) or not ai.target.alive): ai["target"] = null
	var z: Dictionary = match_ref.zone
	var here = Vector2(global_position.x, global_position.z)
	if here.distance_to(z.c) > float(z.r) * 0.85 or (float(z.timer) < 25.0 and here.distance_to(z.tc) > float(z.tr) * 0.8):
		var dir: Vector2 = (z.tc - here).normalized()
		var goal2: Vector2 = z.tc - dir * float(z.tr) * 0.4
		ai["goal"] = Vector3(goal2.x, 0, goal2.y); ai["loot_id"] = -1
		return
	if ai.goal != null and not ai.has("wander"): return
	var it = match_ref.nearest_useful_loot(self, 45.0)
	if it != null:
		ai["goal"] = it.pos; ai["loot_id"] = int(it.id); ai.erase("wander"); return
	if ai.goal == null or global_position.distance_to(ai.goal) < 3.0:
		var a = Game.rng.randf() * TAU; var r = Game.rng.randf_range(30.0, 80.0)
		var g = here + Vector2(cos(a), sin(a)) * r
		if g.distance_to(z.tc) > float(z.tr) * 0.8: g = g.lerp(z.tc, 0.5)
		ai["goal"] = Vector3(g.x, 0, g.y); ai["wander"] = true; ai["loot_id"] = -1

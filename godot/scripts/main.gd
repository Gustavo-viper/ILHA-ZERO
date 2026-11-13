extends Node3D
## Menu, sala de espera (LAN), início da partida e controles do jogador local.

const WorldScript := preload("res://scripts/world.gd")
const MatchScript := preload("res://scripts/match.gd")
const HudScript := preload("res://scripts/hud.gd")
const QualityScript := preload("res://scripts/quality.gd")

var menu: CanvasLayer
var status_lbl: Label
var name_edit: LineEdit
var ip_edit: LineEdit
var lobby_panel: PanelContainer
var lobby_lbl: Label
var start_btn: Button
var settings_panel: PanelContainer
var pause_panel: PanelContainer
var players := {}          # peer_id -> nome
var world: Node3D
var match_node: Node3D
var hud: CanvasLayer
var quality: Node
var in_game := false

func _ready() -> void:
	multiplayer.multiplayer_peer = OfflineMultiplayerPeer.new()
	_build_menu()

# ---------------------------------------------------------------- menu
func _btn(parent: Control, text: String, cb: Callable, primary := false) -> Button:
	var b := Button.new(); b.text = text; b.custom_minimum_size = Vector2(0, 46)
	b.add_theme_font_size_override("font_size", 18)
	if primary:
		var sb := StyleBoxFlat.new(); sb.bg_color = Color(1.0, 0.69, 0.18); sb.set_corner_radius_all(8)
		b.add_theme_stylebox_override("normal", sb); b.add_theme_color_override("font_color", Color(0.1, 0.07, 0.02))
		var sbh := sb.duplicate(); sbh.bg_color = Color(1.0, 0.78, 0.35); b.add_theme_stylebox_override("hover", sbh)
	b.pressed.connect(cb); parent.add_child(b); return b

func _panel(min_size: Vector2) -> PanelContainer:
	var p := PanelContainer.new(); p.custom_minimum_size = min_size
	var sb := StyleBoxFlat.new(); sb.bg_color = Color(0.05, 0.07, 0.1, 0.9); sb.set_corner_radius_all(12); sb.set_content_margin_all(26)
	sb.border_color = Color(1, 1, 1, 0.12); sb.set_border_width_all(1)
	p.add_theme_stylebox_override("panel", sb); return p

func _build_menu() -> void:
	menu = CanvasLayer.new(); add_child(menu)
	var bg := ColorRect.new(); bg.color = Color(0.05, 0.07, 0.09); bg.set_anchors_preset(Control.PRESET_FULL_RECT); menu.add_child(bg)
	var center := CenterContainer.new(); center.set_anchors_preset(Control.PRESET_FULL_RECT); menu.add_child(center)
	var p := _panel(Vector2(560, 0)); center.add_child(p)
	var v := VBoxContainer.new(); v.add_theme_constant_override("separation", 10); p.add_child(v)
	var title := Label.new(); title.text = "ILHA ZERO"; title.add_theme_font_size_override("font_size", 54); title.add_theme_color_override("font_color", Color(1.0, 0.72, 0.25)); v.add_child(title)
	var sub := Label.new(); sub.text = "Battle royale tático · ilha de 1,8 km · até 50 jogadores"; sub.add_theme_color_override("font_color", Color(1, 1, 1, 0.7)); v.add_child(sub)
	name_edit = LineEdit.new(); name_edit.placeholder_text = "Seu nome"; name_edit.text = String(Game.settings["name"]); name_edit.max_length = 16; name_edit.custom_minimum_size.y = 40; v.add_child(name_edit)
	_btn(v, "JOGAR OFFLINE (contra bots)", _play_offline, true)
	_btn(v, "CRIAR PARTIDA NA REDE LOCAL (host)", _host)
	var h := HBoxContainer.new(); v.add_child(h)
	ip_edit = LineEdit.new(); ip_edit.text = String(Game.settings["ip"]); ip_edit.placeholder_text = "IP do host (ex.: 192.168.0.10)"; ip_edit.size_flags_horizontal = Control.SIZE_EXPAND_FILL; ip_edit.custom_minimum_size.y = 40; h.add_child(ip_edit)
	var jb := Button.new(); jb.text = "  ENTRAR  "; jb.pressed.connect(_join); h.add_child(jb)
	_btn(v, "Gráficos e controles", func(): settings_panel.visible = true)
	_btn(v, "Sair", func(): get_tree().quit())
	status_lbl = Label.new(); status_lbl.add_theme_color_override("font_color", Color(1.0, 0.8, 0.45)); status_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD; v.add_child(status_lbl)
	var hw := Label.new(); hw.add_theme_font_size_override("font_size", 13); hw.add_theme_color_override("font_color", Color(1, 1, 1, 0.65)); hw.autowrap_mode = TextServer.AUTOWRAP_WORD
	var H: Dictionary = Game.hw
	hw.text = "GPU: %s\nCPU: %d núcleos · RAM: %s · Renderizador: %s\nQualidade automática: %s (ajusta sozinha pelo FPS)" % [H.gpu, H.cores, ("%.0f GB" % H.mem_gb) if H.mem_gb > 0 else "n/d", "OpenGL (compatibilidade)" if H.compat else "Vulkan (Forward+)", Game.tier_name(H.tier)]
	v.add_child(hw)
	var keys := Label.new(); keys.add_theme_font_size_override("font_size", 12); keys.add_theme_color_override("font_color", Color(1, 1, 1, 0.5)); keys.autowrap_mode = TextServer.AUTOWRAP_WORD
	keys.text = "WASD mover · Shift correr · Espaço pular · C agachar · Z deitar · Q/E inclinar · Alt olhar livre · V 1ª/3ª pessoa\nMouse atirar · Botão direito mirar · R recarregar · F pegar/saltar/paraquedas · 1/2/3 armas · X guardar · B modo de tiro\n4 bandagem · 5 primeiros socorros · 6 kit médico · 7 energético · 8 analgésico · Tab inventário · M mapa · Esc pausa"
	v.add_child(keys)
	# sala de espera
	lobby_panel = _panel(Vector2(460, 0)); lobby_panel.visible = false
	var c2 := CenterContainer.new(); c2.set_anchors_preset(Control.PRESET_FULL_RECT); c2.mouse_filter = Control.MOUSE_FILTER_IGNORE; menu.add_child(c2); c2.add_child(lobby_panel)
	var lv := VBoxContainer.new(); lv.add_theme_constant_override("separation", 10); lobby_panel.add_child(lv)
	var lt := Label.new(); lt.text = "SALA DE ESPERA"; lt.add_theme_font_size_override("font_size", 28); lv.add_child(lt)
	lobby_lbl = Label.new(); lv.add_child(lobby_lbl)
	start_btn = _btn(lv, "INICIAR PARTIDA", _host_start, true)
	_btn(lv, "Cancelar", back_to_menu)
	_build_settings()

func _build_settings() -> void:
	settings_panel = _panel(Vector2(520, 0)); settings_panel.visible = false
	var c := CenterContainer.new(); c.set_anchors_preset(Control.PRESET_FULL_RECT); c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	menu.add_child(c); c.add_child(settings_panel)
	var v := VBoxContainer.new(); v.add_theme_constant_override("separation", 8); settings_panel.add_child(v)
	var t := Label.new(); t.text = "Gráficos e controles"; t.add_theme_font_size_override("font_size", 26); v.add_child(t)
	var row := func(label: String, ctrl: Control) -> void:
		var h := HBoxContainer.new(); var l := Label.new(); l.text = label; l.size_flags_horizontal = Control.SIZE_EXPAND_FILL; h.add_child(l)
		ctrl.custom_minimum_size.x = 240; h.add_child(ctrl); v.add_child(h)
	var q := OptionButton.new()
	q.add_item("Automático — " + Game.tier_name(Game.hw.tier), 0)
	for i in 6: q.add_item(Game.tier_name(i), i + 1)
	q.selected = int(Game.settings["tier"]) + 1
	q.item_selected.connect(_on_tier_selected)
	row.call("Qualidade", q)
	var mk_slider := func(key: String, lo: float, hi: float, step: float) -> HSlider:
		var s := HSlider.new(); s.min_value = lo; s.max_value = hi; s.step = step; s.value = float(Game.settings[key])
		s.value_changed.connect(_on_setting.bind(key))
		return s
	row.call("Sensibilidade do mouse", mk_slider.call("sens", 0.2, 3.0, 0.05))
	row.call("Campo de visão (FOV)", mk_slider.call("fov", 60.0, 103.0, 1.0))
	row.call("Volume", mk_slider.call("volume", 0.0, 1.0, 0.05))
	row.call("Bots na partida offline", mk_slider.call("bots", 5.0, 49.0, 1.0))
	var dyn := CheckBox.new(); dyn.button_pressed = bool(Game.settings["dyn_res"]); dyn.text = "ligada"
	dyn.toggled.connect(_on_dyn)
	row.call("Resolução dinâmica", dyn)
	var fps := CheckBox.new(); fps.button_pressed = bool(Game.settings["show_fps"]); fps.text = "mostrar"
	fps.toggled.connect(_on_fps)
	row.call("FPS e informações", fps)
	var note := Label.new(); note.autowrap_mode = TextServer.AUTOWRAP_WORD; note.add_theme_font_size_override("font_size", 12); note.add_theme_color_override("font_color", Color(1, 1, 1, 0.6))
	note.text = "Batata/Baixo: resolução reduzida (FSR), poucas sombras, sem capim ou capim curto — para PCs antigos (o jogo também roda em OpenGL quando não há Vulkan).\nUltra/Extremo: iluminação global em tempo real (SDFGI), reflexos (SSR), SSAO/SSIL, neblina volumétrica, sombras de longa distância; o Extremo renderiza acima da tela (supersampling até 8K)."
	v.add_child(note)
	_btn(v, "Fechar", _close_settings, true)

func _on_tier_selected(i: int) -> void:
	Game.settings["tier"] = i - 1
	Game.save_settings()
	if quality:
		quality.auto = i == 0
		quality.apply(Game.current_tier())

func _on_setting(val: float, key: String) -> void:
	Game.settings[key] = val
	Game.save_settings()

func _on_dyn(on: bool) -> void:
	Game.settings["dyn_res"] = on
	Game.save_settings()
	if quality: quality.dyn_res = on

func _on_fps(on: bool) -> void:
	Game.settings["show_fps"] = on
	Game.save_settings()

func _close_settings() -> void:
	settings_panel.visible = false
	if in_game:
		menu.visible = false
		capture_mouse()

func _open_settings_ingame() -> void:
	menu.visible = true
	settings_panel.visible = true
	menu.get_child(0).visible = false   # fundo
	menu.get_child(1).visible = false   # menu principal
	pause_panel.visible = false

# ---------------------------------------------------------------- rede
func _on_peer_left(id: int) -> void:
	players.erase(id)
	rpc_lobby.rpc(_players_array())

func _on_connected(my_name: String) -> void:
	rpc_hello.rpc_id(1, my_name)
	status_lbl.text = "Conectado! Aguardando o host iniciar."
	lobby_panel.visible = true
	start_btn.visible = false

func _on_conn_failed() -> void:
	status_lbl.text = "Não conectou. Confira o IP e o firewall do host (porta %d UDP)." % Game.PORT

func _on_tier_changed(t: int, dir: String) -> void:
	if hud: hud.show_center("Qualidade %s automática: %s" % ["↑" if dir == "up" else "↓", Game.tier_name(t)], 3.0)

func _my_name() -> String:
	var n := name_edit.text.strip_edges()
	if n == "": n = "Jogador%d" % Game.rng.randi_range(100, 999)
	Game.settings["name"] = name_edit.text.strip_edges(); Game.save_settings()
	return n

func _play_offline() -> void:
	multiplayer.multiplayer_peer = OfflineMultiplayerPeer.new()
	_begin(Game.rng.randi(), [[1, _my_name()]], int(Game.settings["bots"]))

func _host() -> void:
	var peer := ENetMultiplayerPeer.new()
	var err := peer.create_server(Game.PORT, 16)
	if err != OK:
		status_lbl.text = "Não foi possível criar o servidor (porta %d em uso?)" % Game.PORT
		return
	multiplayer.multiplayer_peer = peer
	players = {1: _my_name()}
	multiplayer.peer_disconnected.connect(_on_peer_left)
	lobby_panel.visible = true; start_btn.visible = true
	var ips := []
	for ip in IP.get_local_addresses():
		if ip.count(".") == 3 and not ip.begins_with("127.") and not ip.begins_with("169.254"): ips.append(ip)
	status_lbl.text = "Partida criada. Seus amigos na mesma rede entram com o IP: " + ", ".join(ips)
	_refresh_lobby()

func _join() -> void:
	var peer := ENetMultiplayerPeer.new()
	Game.settings["ip"] = ip_edit.text.strip_edges(); Game.save_settings()
	var err := peer.create_client(ip_edit.text.strip_edges(), Game.PORT)
	if err != OK:
		status_lbl.text = "IP inválido."
		return
	multiplayer.multiplayer_peer = peer
	status_lbl.text = "Conectando a %s…" % ip_edit.text
	var my_name := _my_name()
	multiplayer.connected_to_server.connect(_on_connected.bind(my_name), CONNECT_ONE_SHOT)
	multiplayer.connection_failed.connect(_on_conn_failed, CONNECT_ONE_SHOT)
	multiplayer.server_disconnected.connect(back_to_menu, CONNECT_ONE_SHOT)

@rpc("any_peer", "reliable")
func rpc_hello(n: String) -> void:
	if not multiplayer.is_server(): return
	players[multiplayer.get_remote_sender_id()] = n.left(16)
	rpc_lobby.rpc(_players_array())

func _players_array() -> Array:
	var arr := []
	var ids := players.keys(); ids.sort()
	for id in ids: arr.append([id, players[id]])
	return arr

@rpc("authority", "call_local", "reliable")
func rpc_lobby(arr: Array) -> void:
	players.clear()
	for e in arr: players[int(e[0])] = String(e[1])
	_refresh_lobby()

func _refresh_lobby() -> void:
	var names := []
	for id in players: names.append("• " + String(players[id]) + (" (host)" if int(id) == 1 else ""))
	lobby_lbl.text = "Jogadores (%d):\n%s\n\nAs vagas restantes viram bots." % [players.size(), "\n".join(names)]

func _host_start() -> void:
	var humans := _players_array()
	rpc_start.rpc(Game.rng.randi(), humans, maxi(0, int(Game.settings["bots"]) + 1 - humans.size()))

@rpc("authority", "call_local", "reliable")
func rpc_start(seed_v: int, humans: Array, bots: int) -> void:
	_begin(seed_v, humans, bots)

# ---------------------------------------------------------------- partida
func _begin(seed_v: int, humans: Array, bots: int) -> void:
	status_lbl.text = "Gerando a ilha…"
	lobby_panel.visible = false
	await get_tree().process_frame
	await get_tree().process_frame
	world = WorldScript.new(); world.name = "World"; add_child(world)
	world.generate(seed_v)
	match_node = MatchScript.new(); match_node.name = "Match"; add_child(match_node)
	match_node.start(world, seed_v, humans, bots, multiplayer.get_unique_id())
	quality = QualityScript.new(); quality.name = "Quality"; add_child(quality)
	quality.setup(world.env, world.sun, world)
	quality.tier_changed.connect(_on_tier_changed)
	hud = HudScript.new(); add_child(hud)
	hud.setup(self, match_node, quality, world.make_map_image(512))
	match_node.match_ended.connect(_on_match_end)
	menu.visible = false
	in_game = true
	capture_mouse()

func capture_mouse() -> void:
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	if pause_panel: pause_panel.visible = false

func back_to_menu() -> void:
	if multiplayer.multiplayer_peer: multiplayer.multiplayer_peer.close()
	multiplayer.multiplayer_peer = OfflineMultiplayerPeer.new()
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	get_tree().reload_current_scene()

func hit_marker(head: bool) -> void:
	if hud: hud.hit(head)

func on_hurt(attacker, zone_dmg: bool) -> void:
	var me: Soldier = match_node.local
	if hud == null or me == null or zone_dmg or attacker == null: return
	var d: Vector3 = attacker.global_position - me.global_position
	var ang := atan2(-d.x, -d.z) - me.yaw
	hud.hurt_from(-ang)

func on_local_dead(killer, place: int) -> void:
	var me: Soldier = match_node.local
	me.spectate = killer if killer != null and killer != me else null
	await get_tree().create_timer(1.5).timeout
	if match_node.ended: return
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	hud.show_end("#%d" % place, ("Abatido por %s" % killer.display_name if killer != null and killer != me else "Você morreu") + " · %d abate(s)\nVocê pode assistir até o fim da partida." % me.kills)

func _on_match_end(text: String) -> void:
	var parts := text.split("|")
	var me: Soldier = match_node.local
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	if me and parts[0] == String(me.name):
		hud.show_end("VITÓRIA!", "Você foi o último de pé na Ilha Zero com %s abate(s)! 🏆" % parts[2])
	else:
		hud.show_end("FIM DE PARTIDA", "Vencedor: %s (%s abates)" % [parts[1], parts[2]])

# ---------------------------------------------------------------- controles
func _unhandled_input(e: InputEvent) -> void:
	if not in_game: return
	var me: Soldier = match_node.local
	if me == null: return
	if e is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		var k := 0.0022 * float(Game.settings["sens"])
		if me.aiming: k *= 0.7 / maxf(1.0, me.scope_zoom() * 0.6)
		var free := me.freelook or me.state == "plane" or not me.alive
		if free:
			me.look_yaw -= e.relative.x * k; me.look_pitch = clampf(me.look_pitch - e.relative.y * k, -1.4, 1.2)
		else:
			me.yaw -= e.relative.x * k; me.pitch = clampf(me.pitch - e.relative.y * k, -1.45, 1.45)
	if e.is_action_pressed("menu"): _toggle_pause()

func _toggle_pause() -> void:
	if pause_panel == null:
		pause_panel = _panel(Vector2(360, 0))
		var c := CenterContainer.new(); c.set_anchors_preset(Control.PRESET_FULL_RECT); c.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var layer := CanvasLayer.new(); layer.layer = 10; add_child(layer); layer.add_child(c); c.add_child(pause_panel)
		var v := VBoxContainer.new(); v.add_theme_constant_override("separation", 10); pause_panel.add_child(v)
		var t := Label.new(); t.text = "PAUSA (a partida continua)"; t.add_theme_font_size_override("font_size", 22); v.add_child(t)
		_btn(v, "Continuar", capture_mouse, true)
		_btn(v, "Gráficos e controles", _open_settings_ingame)
		_btn(v, "Voltar ao menu", back_to_menu)
	if pause_panel.visible: capture_mouse()
	else:
		pause_panel.visible = true; Input.mouse_mode = Input.MOUSE_MODE_VISIBLE

func _process(_dt: float) -> void:
	if not in_game or match_node == null: return
	var me: Soldier = match_node.local
	if me == null: return
	if settings_panel.visible == false and menu.visible and in_game:
		menu.visible = false
		if pause_panel == null or not pause_panel.visible: capture_mouse()
	var captured := Input.mouse_mode == Input.MOUSE_MODE_CAPTURED
	hud.show_map = Input.is_action_pressed("map") if captured else false
	if Input.is_action_just_pressed("map"): hud.show_map = true
	hud.show_inv = Input.is_action_pressed("inventory")
	if not captured:
		me.aiming = false
		return
	if not me.alive:
		if Input.is_action_just_pressed("jump"):
			var alive_list := match_node.soldiers().filter(func(s): return s.alive)
			if not alive_list.is_empty():
				var i := alive_list.find(me.spectate)
				me.spectate = alive_list[(i + 1) % alive_list.size()]
		return
	me.freelook = Input.is_action_pressed("freelook")
	if Input.is_action_just_released("freelook"):
		me.look_yaw = me.yaw
		me.look_pitch = me.pitch
	if not me.freelook and me.state != "plane":
		me.look_yaw = me.yaw
		me.look_pitch = me.pitch
	if Input.is_action_just_pressed("toggle_view"): me.first_person = not me.first_person
	if Input.is_action_just_pressed("interact"):
		if me.state == "plane" and match_node.phase != "countdown": me.jump_from_plane(match_node.plane_pos())
		elif me.state == "air": me.open_chute()
		elif me.state == "ground":
			var it = match_node.nearest_loot(me.global_position)
			if it != null: match_node.request_pickup(me, int(it.id))
	if me.state != "ground":
		me.aiming = false
		return
	if Input.is_action_just_pressed("crouch"):
		me.stance = 0 if me.stance == 1 else 1
		me._update_hitbox()
	if Input.is_action_just_pressed("prone"):
		me.stance = 0 if me.stance == 2 else 2
		me._update_hitbox()
	if Input.is_action_just_pressed("reload"): me.start_reload()
	if Input.is_action_just_pressed("firemode"): me.auto_fire = not me.auto_fire
	for i in 3:
		if Input.is_action_just_pressed("slot%d" % (i + 1)) and me.weapons[i] != null and me.cur != i:
			me.cur = i; me.action = "" if me.action == "reload" else me.action; me.set_weapon_visual()
	if Input.is_action_just_pressed("holster"):
		me.cur = -1
		me.set_weapon_visual()
	for hname in ["bandage", "firstaid", "medkit", "drink", "pills"]:
		if Input.is_action_just_pressed("use_" + hname): me.start_heal(hname)
	me.aiming = Input.is_action_pressed("aim") and me.current_weapon() != null and not me.sprinting
	var d := me.weapon_def()
	if not d.is_empty() and me.can_fire():
		var auto := bool(d.auto) and me.auto_fire
		if (auto and Input.is_action_pressed("fire")) or Input.is_action_just_pressed("fire"):
			me.fire(_aim_point(me))
	elif not d.is_empty() and Input.is_action_just_pressed("fire") and me.current_weapon() != null and int(me.current_weapon().mag) == 0:
		me.start_reload()

func _aim_point(me: Soldier) -> Vector3:
	var cam := get_viewport().get_camera_3d()
	var from := cam.global_position
	var dir := -cam.global_basis.z
	var q := PhysicsRayQueryParameters3D.create(from, from + dir * 1500.0, Game.L_WORLD | Game.L_HITBOX)
	q.collide_with_areas = true
	q.exclude = [me.get_rid(), me.hitbox.get_rid()]
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	return hit.position if not hit.is_empty() else from + dir * 1500.0

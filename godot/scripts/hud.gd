extends CanvasLayer
## Interface do jogo (desenhada por código).

var main
var match_ref
var quality
var map_tex: Texture2D
var font: Font

var compass: Control
var cross: Control
var scope_overlay: Control
var minimap: Control
var bigmap: Control
var bars: Control
var dmg_layer: Control
var lbl_alive: Label
var lbl_kills: Label
var lbl_center: Label
var lbl_prompt: Label
var lbl_action: Label
var lbl_weapons: Label
var lbl_ammo: Label
var lbl_gear: Label
var lbl_perf: Label
var lbl_inv: Label
var feed: VBoxContainer
var end_panel: PanelContainer
var end_title: Label
var end_text: Label

var hit_t = 0.0
var hit_head = false
var hurt_dirs: Array = []    # [angle, t]
var center_t = 0.0
var show_map = false
var show_inv = false

func setup(m: Node, mr: Node, q: Node, tex: Texture2D) -> void:
	main = m; match_ref = mr; quality = q; map_tex = tex
	font = ThemeDB.fallback_font
	var root = Control.new(); root.set_anchors_preset(Control.PRESET_FULL_RECT); root.mouse_filter = Control.MOUSE_FILTER_IGNORE; add_child(root)
	scope_overlay = _canvas(root, Control.PRESET_FULL_RECT, _draw_scope); scope_overlay.visible = false
	dmg_layer = _canvas(root, Control.PRESET_FULL_RECT, _draw_damage)
	cross = _canvas(root, Control.PRESET_FULL_RECT, _draw_cross)
	compass = _canvas(root, Control.PRESET_CENTER_TOP, _draw_compass); compass.custom_minimum_size = Vector2(520, 46); compass.position = Vector2(-260, 10); compass.size = Vector2(520, 46)
	bars = _canvas(root, Control.PRESET_CENTER_BOTTOM, _draw_bars); bars.position = Vector2(-230, -70); bars.size = Vector2(460, 50)
	minimap = _canvas(root, Control.PRESET_BOTTOM_RIGHT, _draw_minimap); minimap.position = Vector2(-236, -236); minimap.size = Vector2(220, 220)
	bigmap = _canvas(root, Control.PRESET_FULL_RECT, _draw_bigmap); bigmap.visible = false
	lbl_alive = _label(root, Control.PRESET_TOP_RIGHT, Vector2(-190, 12), 22, HORIZONTAL_ALIGNMENT_RIGHT, 170)
	lbl_kills = _label(root, Control.PRESET_TOP_RIGHT, Vector2(-190, 42), 18, HORIZONTAL_ALIGNMENT_RIGHT, 170)
	lbl_center = _label(root, Control.PRESET_CENTER_TOP, Vector2(-400, 90), 26, HORIZONTAL_ALIGNMENT_CENTER, 800)
	lbl_prompt = _label(root, Control.PRESET_CENTER, Vector2(-250, 70), 19, HORIZONTAL_ALIGNMENT_CENTER, 500)
	lbl_action = _label(root, Control.PRESET_CENTER, Vector2(-200, 110), 17, HORIZONTAL_ALIGNMENT_CENTER, 400)
	lbl_weapons = _label(root, Control.PRESET_BOTTOM_RIGHT, Vector2(-620, -128), 17, HORIZONTAL_ALIGNMENT_RIGHT, 360)
	lbl_ammo = _label(root, Control.PRESET_BOTTOM_RIGHT, Vector2(-620, -60), 34, HORIZONTAL_ALIGNMENT_RIGHT, 360)
	lbl_gear = _label(root, Control.PRESET_BOTTOM_LEFT, Vector2(20, -120), 16, HORIZONTAL_ALIGNMENT_LEFT, 420)
	lbl_perf = _label(root, Control.PRESET_TOP_LEFT, Vector2(12, 10), 13, HORIZONTAL_ALIGNMENT_LEFT, 600)
	lbl_inv = _label(root, Control.PRESET_CENTER_LEFT, Vector2(30, -220), 16, HORIZONTAL_ALIGNMENT_LEFT, 420); lbl_inv.visible = false
	var bg = StyleBoxFlat.new(); bg.bg_color = Color(0, 0, 0, 0.6); bg.set_content_margin_all(14); bg.set_corner_radius_all(6)
	lbl_inv.add_theme_stylebox_override("normal", bg)
	feed = VBoxContainer.new(); feed.set_anchors_preset(Control.PRESET_TOP_RIGHT); feed.position = Vector2(-470, 76); feed.size = Vector2(450, 200); feed.alignment = BoxContainer.ALIGNMENT_BEGIN
	feed.mouse_filter = Control.MOUSE_FILTER_IGNORE; root.add_child(feed)
	_build_end_panel(root)
	match_ref.killfeed.connect(_on_feed)
	match_ref.announce.connect(func(t): show_center(t, 4.0))

func _canvas(parent: Control, preset: int, fn: Callable) -> Control:
	var c = Control.new(); c.set_anchors_preset(preset); c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	c.draw.connect(fn.bind(c)); parent.add_child(c)
	return c

func _label(parent: Control, preset: int, pos: Vector2, fs: int, align: int, w: float) -> Label:
	var l = Label.new(); l.set_anchors_preset(preset); l.position = pos; l.size = Vector2(w, 30)
	l.horizontal_alignment = align; l.add_theme_font_size_override("font_size", fs)
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8)); l.add_theme_constant_override("shadow_offset_x", 1); l.add_theme_constant_override("shadow_offset_y", 1)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(l); return l

func _build_end_panel(root: Control) -> void:
	end_panel = PanelContainer.new(); end_panel.set_anchors_preset(Control.PRESET_CENTER); end_panel.position = Vector2(-280, -150); end_panel.size = Vector2(560, 300)
	var sb = StyleBoxFlat.new(); sb.bg_color = Color(0.06, 0.08, 0.1, 0.92); sb.set_corner_radius_all(10); sb.set_content_margin_all(24); end_panel.add_theme_stylebox_override("panel", sb)
	var v = VBoxContainer.new(); v.add_theme_constant_override("separation", 14); end_panel.add_child(v)
	end_title = Label.new(); end_title.add_theme_font_size_override("font_size", 46); end_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; end_title.add_theme_color_override("font_color", Color(1.0, 0.75, 0.25)); v.add_child(end_title)
	end_text = Label.new(); end_text.add_theme_font_size_override("font_size", 18); end_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; end_text.autowrap_mode = TextServer.AUTOWRAP_WORD; v.add_child(end_text)
	var b1 = Button.new(); b1.text = "Assistir (Espaço troca de jogador)"; b1.pressed.connect(_on_watch); v.add_child(b1)
	var b2 = Button.new(); b2.text = "Voltar ao menu"; b2.pressed.connect(func(): main.back_to_menu()); v.add_child(b2)
	end_panel.visible = false; root.add_child(end_panel)

# ---------------------------------------------------------------- eventos
func show_center(t: String, secs = 3.0) -> void:
	lbl_center.text = t; center_t = secs

func hit(head: bool) -> void:
	hit_t = 0.18; hit_head = head

func hurt_from(angle: float) -> void:
	hurt_dirs.append([angle, 1.2])

func _on_feed(t: String, mine: bool) -> void:
	var l = Label.new(); l.text = t; l.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	l.add_theme_font_size_override("font_size", 15)
	l.add_theme_color_override("font_color", Color(1.0, 0.8, 0.35) if mine else Color(0.95, 0.95, 0.95))
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.9))
	feed.add_child(l)
	while feed.get_child_count() > 6:
		feed.get_child(0).queue_free()
		feed.remove_child(feed.get_child(0))
	get_tree().create_timer(8.0).timeout.connect(_free_if_valid.bind(l))

func _on_watch() -> void:
	end_panel.visible = false
	main.capture_mouse()

func _free_if_valid(n: Node) -> void:
	if is_instance_valid(n): n.queue_free()

func show_end(title: String, text: String) -> void:
	end_title.text = title; end_text.text = text; end_panel.visible = true

# ---------------------------------------------------------------- por quadro
func _process(dt: float) -> void:
	var me: Soldier = match_ref.local
	if me == null: return
	hit_t -= dt; center_t -= dt
	if center_t <= 0.0: lbl_center.text = ""
	for d in hurt_dirs: d[1] = float(d[1]) - dt
	hurt_dirs = hurt_dirs.filter(func(d): return float(d[1]) > 0.0)
	lbl_alive.text = "%d VIVOS" % match_ref.alive_count()
	lbl_kills.text = "%d abates" % me.kills
	var w = me.current_weapon()
	var names = []
	for i in 3:
		var ww = me.weapons[i]
		var nm: String = Game.WEAPONS[ww.id].name if ww != null else "—"
		if ww != null and float(ww.get("scope", 1.0)) > 1.0: nm += " [%dx]" % int(ww.scope)
		names.append(("▶ " if i == me.cur else "   ") + "%d  %s" % [i + 1, nm])
	lbl_weapons.text = "\n".join(names)
	if w != null:
		var d: Dictionary = Game.WEAPONS[w.id]
		lbl_ammo.text = "%d / %d  %s" % [int(w.mag), int(me.ammo.get(d.ammo, 0)), ("AUTO" if me.auto_fire and bool(d.auto) else "TIRO")]
	else: lbl_ammo.text = ""
	lbl_gear.text = "Colete Nv%d · Capacete Nv%d · Mochila Nv%d\n[4] Bandagem %d  [5] Primeiros socorros %d  [6] Kit médico %d\n[7] Energético %d  [8] Analgésico %d" % [me.vest, me.helmet, me.pack, me.heals.bandage, me.heals.firstaid, me.heals.medkit, me.heals.drink, me.heals.pills]
	if me.action != "":
		var nm2: String = "Recarregando" if me.action == "reload" else "Usando " + String(Game.HEALS[me.action].name)
		lbl_action.text = "%s  %.1fs" % [nm2, maxf(0.0, me.action_t)]
	else: lbl_action.text = ""
	# aviso de interação
	var prompt = ""
	if me.state == "plane" and match_ref.phase != "countdown": prompt = "[F] Saltar do avião"
	elif me.state == "air": prompt = "[F] Abrir paraquedas   ·   W mergulha"
	elif me.alive and me.state == "ground":
		var it = match_ref.nearest_loot(me.global_position)
		if it != null: prompt = "[F] Pegar %s" % Game.item_name(it.type) + ((" (%d)" % int(it.amount)) if String(it.type).begins_with("ammo") else "")
	if match_ref.phase == "countdown": prompt = "Decolagem em %d…" % int(ceil(float(match_ref.plane.t0) - match_ref.time))
	lbl_prompt.text = prompt
	var z: Dictionary = match_ref.zone
	var outside: bool = Vector2(me.global_position.x, me.global_position.z).distance_to(z.c) > float(z.r) and me.alive and me.state == "ground"
	if outside and center_t <= 0.0: lbl_center.text = "Você está FORA da área segura!"
	lbl_inv.visible = show_inv
	if show_inv: lbl_inv.text = _inventory_text(me)
	scope_overlay.visible = me.aiming and me.scope_zoom() > 1.0 and me.state == "ground"
	bigmap.visible = show_map
	lbl_perf.visible = bool(Game.settings["show_fps"])
	if lbl_perf.visible:
		var rs: Vector2i = quality.render_size()
		var res_tag = " (8K)" if rs.x >= 7600 else (" (4K)" if rs.x >= 3800 else "")
		lbl_perf.text = "FPS %d · %s%s\nRender %dx%d%s · escala %.2fx\nGPU: %s%s" % [int(quality.fps), Game.tier_name(quality.tier), " [auto]" if quality.auto else "", rs.x, rs.y, res_tag, quality.scale, Game.hw.get("gpu", "?"), " (OpenGL)" if Game.hw.get("compat", false) else ""]
	for c in [compass, cross, minimap, bars, dmg_layer]: c.queue_redraw()
	if scope_overlay.visible: scope_overlay.queue_redraw()
	if bigmap.visible: bigmap.queue_redraw()

func _inventory_text(me: Soldier) -> String:
	var lines = ["INVENTÁRIO (Tab)", ""]
	for a in me.ammo:
		if int(me.ammo[a]) > 0: lines.append("%s: %d" % [Game.AMMO_NAME[a], int(me.ammo[a])])
	for hname in me.heals:
		if int(me.heals[hname]) > 0: lines.append("%s: %d" % [Game.HEALS[hname].name, int(me.heals[hname])])
	for s in me.spare: lines.append("%s (sem arma compatível)" % Game.ATTACH[s])
	for w in me.weapons:
		if w != null:
			var att = []
			if float(w.scope) > float(Game.WEAPONS[w.id].scope): att.append("mira %dx" % int(w.scope))
			if w.extmag: att.append("carregador estendido")
			if w.comp: att.append("compensador")
			lines.append("%s %s" % [Game.WEAPONS[w.id].name, ("(" + ", ".join(att) + ")") if not att.is_empty() else ""])
	return "\n".join(lines)

# ---------------------------------------------------------------- desenho
func _draw_compass(c: Control) -> void:
	var me: Soldier = match_ref.local
	var heading = fposmod(rad_to_deg(-(me.look_yaw if me.freelook else me.yaw)), 360.0)
	var w = c.size.x
	c.draw_rect(Rect2(Vector2.ZERO, c.size), Color(0, 0, 0, 0.28))
	var px_per_deg = 3.2
	var labels = {0: "N", 45: "NE", 90: "L", 135: "SE", 180: "S", 225: "SO", 270: "O", 315: "NO"}
	for deg in range(0, 360, 5):
		var dx = wrapf(deg - heading, -180.0, 180.0) * px_per_deg
		if absf(dx) > w * 0.5 - 4.0: continue
		var x = w * 0.5 + dx
		var major = deg % 15 == 0
		c.draw_line(Vector2(x, 0), Vector2(x, 8 if major else 4), Color(1, 1, 1, 0.8), 1.0)
		if labels.has(deg): c.draw_string(font, Vector2(x - 10, 28), labels[deg], HORIZONTAL_ALIGNMENT_CENTER, 20, 17, Color(1.0, 0.85, 0.4) if deg == 0 else Color.WHITE)
		elif deg % 15 == 0: c.draw_string(font, Vector2(x - 14, 26), str(deg), HORIZONTAL_ALIGNMENT_CENTER, 28, 12, Color(1, 1, 1, 0.8))
	c.draw_string(font, Vector2(w * 0.5 - 20, 44), "%03d" % int(heading), HORIZONTAL_ALIGNMENT_CENTER, 40, 14, Color(1.0, 0.85, 0.4))
	c.draw_line(Vector2(w * 0.5, 0), Vector2(w * 0.5, 12), Color(1.0, 0.85, 0.4), 2.0)

func _draw_cross(c: Control) -> void:
	var me: Soldier = match_ref.local
	var ctr = c.size * 0.5
	if me.alive and me.state in ["ground", "lobby"] and not (me.aiming and me.scope_zoom() > 1.0):
		var d = me.weapon_def()
		var spread: float = (float(d.ads) if me.aiming else float(d.hip)) if not d.is_empty() else 0.02
		if me.move_speed > 0.8: spread += 0.012
		var gap = 4.0 + spread * 900.0 + me.recoil * 200.0
		if me.aiming and gap < 6.0:
			c.draw_circle(ctr, 2.0, Color(1.0, 0.25, 0.2))
		else:
			for v in [Vector2(1, 0), Vector2(-1, 0), Vector2(0, 1), Vector2(0, -1)]:
				c.draw_line(ctr + v * gap, ctr + v * (gap + 9.0), Color(1, 1, 1, 0.9), 2.0)
			c.draw_circle(ctr, 1.3, Color(1, 1, 1, 0.9))
	if hit_t > 0.0:
		var col = Color(1, 0.2, 0.2) if hit_head else Color.WHITE
		for v in [Vector2(1, 1), Vector2(-1, 1), Vector2(1, -1), Vector2(-1, -1)]:
			c.draw_line(ctr + v * 6.0, ctr + v * 14.0, col, 2.0)

func _draw_scope(c: Control) -> void:
	var ctr = c.size * 0.5
	var r = c.size.y * 0.42
	# escurece tudo fora do círculo
	var pts = PackedVector2Array()
	for i in 65: pts.append(ctr + Vector2(cos(i * TAU / 64.0), sin(i * TAU / 64.0)) * r)
	c.draw_rect(Rect2(0, 0, ctr.x - r, c.size.y), Color.BLACK)
	c.draw_rect(Rect2(ctr.x + r, 0, c.size.x - ctr.x - r, c.size.y), Color.BLACK)
	for i in 64:
		var a0 = i * TAU / 64.0; var a1 = (i + 1) * TAU / 64.0
		var outer = PackedVector2Array([ctr + Vector2(cos(a0), sin(a0)) * r, ctr + Vector2(cos(a1), sin(a1)) * r, ctr + Vector2(cos(a1), sin(a1)) * r * 1.6, ctr + Vector2(cos(a0), sin(a0)) * r * 1.6])
		c.draw_colored_polygon(outer, Color.BLACK)
	c.draw_line(Vector2(ctr.x - r, ctr.y), Vector2(ctr.x + r, ctr.y), Color(0, 0, 0, 0.9), 1.5)
	c.draw_line(Vector2(ctr.x, ctr.y - r), Vector2(ctr.x, ctr.y + r), Color(0, 0, 0, 0.9), 1.5)
	for k in range(1, 5):
		c.draw_line(Vector2(ctr.x - 6, ctr.y + k * r * 0.12), Vector2(ctr.x + 6, ctr.y + k * r * 0.12), Color(0, 0, 0, 0.9), 1.5)   # marcas de queda de bala
	c.draw_circle(ctr, 1.6, Color(0.9, 0.1, 0.1))

func _draw_bars(c: Control) -> void:
	var me: Soldier = match_ref.local
	var w = c.size.x
	# boost: 4 segmentos
	for i in 4:
		var seg_w = w / 4.0 - 4.0
		var x = i * (w / 4.0)
		c.draw_rect(Rect2(x, 0, seg_w, 6), Color(0, 0, 0, 0.45))
		var fill = clampf((me.boost - i * 25.0) / 25.0, 0.0, 1.0)
		if fill > 0.0: c.draw_rect(Rect2(x, 0, seg_w * fill, 6), Color(1.0, 0.72, 0.2))
	c.draw_rect(Rect2(0, 12, w, 22), Color(0, 0, 0, 0.5))
	var hpk = clampf(me.hp / 100.0, 0.0, 1.0)
	var col = Color(0.92, 0.92, 0.92) if hpk > 0.5 else (Color(1.0, 0.65, 0.3) if hpk > 0.25 else Color(1.0, 0.25, 0.2))
	c.draw_rect(Rect2(2, 14, (w - 4) * hpk, 18), col)
	c.draw_rect(Rect2(0, 12, w, 22), Color(1, 1, 1, 0.35), false, 1.0)

func _map_draw(c: Control, center: Vector2, world_span: float, rect: Rect2, rotate_with_player = false) -> void:
	var me: Soldier = match_ref.local
	var k = rect.size.x / world_span
	var to_px = func(p: Vector2) -> Vector2: return rect.position + rect.size * 0.5 + (p - center) * k
	var tex_k = map_tex.get_width() / Game.MAP_SIZE
	var src = Rect2((center.x - world_span * 0.5 + Game.HALF) * tex_k, (center.y - world_span * 0.5 + Game.HALF) * tex_k, world_span * tex_k, world_span * tex_k)
	c.draw_rect(rect, Color(0.12, 0.3, 0.42))
	c.draw_texture_rect_region(map_tex, rect, src)
	var z: Dictionary = match_ref.zone
	c.draw_arc(to_px.call(z.c), float(z.r) * k, 0, TAU, 96, Color(0.3, 0.55, 1.0), 2.0)
	c.draw_arc(to_px.call(z.tc), float(z.tr) * k, 0, TAU, 96, Color.WHITE, 2.0)
	if not match_ref.redzone.is_empty() and match_ref.time < float(match_ref.redzone.until):
		c.draw_circle(to_px.call(match_ref.redzone.c), float(match_ref.redzone.r) * k, Color(1, 0.1, 0.1, 0.3))
	if me.state == "plane" or match_ref.phase == "countdown":
		var a: Vector3 = match_ref.plane.a; var b: Vector3 = match_ref.plane.b
		c.draw_dashed_line(to_px.call(Vector2(a.x, a.z)), to_px.call(Vector2(b.x, b.z)), Color(1, 1, 1, 0.8), 2.0, 8.0)
	var pp: Vector2 = to_px.call(Vector2(me.global_position.x, me.global_position.z))
	var fwd = Vector2(-sin(me.yaw), -cos(me.yaw))
	var side = Vector2(-fwd.y, fwd.x)
	c.draw_colored_polygon(PackedVector2Array([pp + fwd * 9.0, pp - fwd * 6.0 + side * 6.0, pp - fwd * 3.0, pp - fwd * 6.0 - side * 6.0]), Color(1.0, 0.8, 0.3))

func _draw_minimap(c: Control) -> void:
	var me: Soldier = match_ref.local
	var r = Rect2(Vector2.ZERO, c.size)
	_map_draw(c, Vector2(me.global_position.x, me.global_position.z), 320.0, r)
	c.draw_rect(r, Color(1, 1, 1, 0.5), false, 2.0)

func _draw_bigmap(c: Control) -> void:
	var s = minf(c.size.x, c.size.y) * 0.9
	var r = Rect2((c.size - Vector2(s, s)) * 0.5, Vector2(s, s))
	c.draw_rect(Rect2(Vector2.ZERO, c.size), Color(0, 0, 0, 0.55))
	_map_draw(c, Vector2.ZERO, Game.MAP_SIZE, r)
	for t in match_ref.world.towns:
		var p: Vector2 = r.position + r.size * 0.5 + t.pos * (r.size.x / Game.MAP_SIZE)
		c.draw_string(font, p - Vector2(50, t.r * r.size.x / Game.MAP_SIZE + 6), t.name, HORIZONTAL_ALIGNMENT_CENTER, 100, 14, Color.WHITE)
	c.draw_string(font, r.position + Vector2(10, 24), "Azul: zona atual · Branco: próxima área segura · Vermelho: bombardeio", HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color.WHITE)

func _draw_damage(c: Control) -> void:
	var ctr = c.size * 0.5
	for d in hurt_dirs:
		var a: float = d[0]
		var alpha = clampf(float(d[1]), 0.0, 1.0)
		var dir = Vector2(sin(a), -cos(a))
		var p = ctr + dir * 150.0
		var side = Vector2(-dir.y, dir.x)
		c.draw_colored_polygon(PackedVector2Array([p + dir * 18.0, p + side * 34.0, p - side * 34.0]), Color(1, 0.1, 0.1, 0.65 * alpha))
	var me: Soldier = match_ref.local
	if me.alive and me.hp < 30.0:
		c.draw_rect(Rect2(Vector2.ZERO, c.size), Color(0.6, 0, 0, 0.12 + 0.08 * sin(Time.get_ticks_msec() * 0.006)))

// Parede da zona azul: translúcida com faixas animadas.
shader_type spatial;
render_mode unshaded, cull_disabled, blend_mix, depth_draw_never, shadows_disabled;
uniform vec4 col : source_color = vec4(0.22, 0.45, 1.0, 0.33);
void fragment() {
	float stripes = 0.8 + 0.2 * sin(UV.x * 600.0 + TIME * 3.0);
	ALBEDO = col.rgb;
	ALPHA = col.a * stripes;
}

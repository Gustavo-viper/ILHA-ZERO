shader_type spatial;
render_mode cull_back, specular_schlick_ggx;
uniform vec3 deep_col : source_color = vec3(0.04, 0.20, 0.28);

void fragment() {
	vec3 w = (INV_VIEW_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float n = sin(w.x * 0.31 + TIME * 1.1) * 0.5 + sin(w.z * 0.23 - TIME * 0.8) * 0.5 + sin((w.x + w.z) * 0.9 + TIME * 2.0) * 0.2;
	NORMAL = normalize(NORMAL + (VIEW_MATRIX * vec4(n * 0.04, 0.0, n * 0.03, 0.0)).xyz);
	ALBEDO = deep_col;
	ROUGHNESS = 0.05;
	SPECULAR = 0.7;
	ALPHA = 0.9;
}

// Tufo de capim: lâminas desenhadas no shader (sem textura), balanço do vento.
shader_type spatial;
render_mode cull_disabled, diffuse_lambert, specular_disabled;

uniform vec3 base_col : source_color = vec3(0.27, 0.30, 0.13);
uniform vec3 tip_col : source_color = vec3(0.80, 0.73, 0.43);
uniform float wind_strength = 0.16;

varying float tint;

void vertex() {
	vec3 wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float h = 1.0 - UV.y;
	float sway = sin(TIME * 1.6 + wp.x * 0.13 + wp.z * 0.09) * wind_strength + sin(TIME * 3.3 + wp.x * 0.6) * 0.05;
	VERTEX.x += sway * h * h;
	VERTEX.z += sway * 0.5 * h * h;
	NORMAL = vec3(0.0, 1.0, 0.0);
	tint = COLOR.r;
}

float h1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }

void fragment() {
	float h = 1.0 - UV.y;
	bool hit = false;
	for (int i = 0; i < 8; i++) {
		float fi = float(i) + 1.0;
		float top = 0.5 + 0.5 * h1(fi * 7.1);
		float lean = (h1(fi * 3.7) - 0.5) * 0.35;
		float x = 0.08 + 0.84 * h1(fi) + lean * h * h;
		float w = 0.04 * (1.0 - h / top);
		if (h < top && abs(UV.x - x) < w) { hit = true; }
	}
	if (!hit) { discard; }
	vec3 c = mix(base_col, tip_col, smoothstep(0.0, 0.9, h));
	ALBEDO = c * mix(vec3(0.85, 1.0, 0.8), vec3(1.05, 1.0, 0.85), tint);
	ROUGHNESS = 0.9;
	BACKLIGHT = vec3(0.25, 0.22, 0.1);
}

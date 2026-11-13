// Terreno: mistura capim seco/verde, terra, rocha (projeção lateral nas encostas) e areia.
// Pesos vêm da cor do vértice (R=capim, G=terra, B=rocha, A=areia).
shader_type spatial;
render_mode blend_mix, cull_back, diffuse_burley, specular_schlick_ggx;

uniform sampler2D noise_a : repeat_enable, filter_linear_mipmap;
uniform sampler2D noise_b : repeat_enable, filter_linear_mipmap;
uniform vec3 grass_dry : source_color = vec3(0.58, 0.54, 0.31);
uniform vec3 grass_green : source_color = vec3(0.33, 0.40, 0.18);
uniform vec3 dirt_col : source_color = vec3(0.43, 0.35, 0.25);
uniform vec3 rock_col : source_color = vec3(0.50, 0.49, 0.46);
uniform vec3 sand_col : source_color = vec3(0.78, 0.71, 0.54);

varying vec3 wpos;
varying vec3 wnorm;
varying vec4 splat;

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wnorm = NORMAL;
	splat = COLOR;
}

void fragment() {
	float n1 = texture(noise_a, wpos.xz / 6.0).r;
	float n2 = texture(noise_b, wpos.xz / 37.0).r;
	float n3 = texture(noise_a, wpos.xz / 260.0).r;
	vec3 g = mix(grass_green, grass_dry, smoothstep(0.35, 0.7, n3)) * (0.72 + 0.55 * n1) * (0.85 + 0.3 * n2);
	vec3 d = dirt_col * (0.65 + 0.7 * n1) * (0.9 + 0.2 * n2);
	vec3 b = abs(wnorm); b = pow(b, vec3(4.0)); b /= (b.x + b.y + b.z);
	float rn = texture(noise_b, wpos.zy / 9.0).r * b.x + texture(noise_b, wpos.xz / 9.0).r * b.y + texture(noise_b, wpos.xy / 9.0).r * b.z;
	vec3 r = rock_col * (0.55 + 0.8 * rn);
	vec3 s = sand_col * (0.85 + 0.3 * n1);
	vec4 w = splat / max(0.001, splat.r + splat.g + splat.b + splat.a);
	ALBEDO = g * w.r + d * w.g + r * w.b + s * w.a;
	ROUGHNESS = 0.95;
	SPECULAR = 0.25;
}

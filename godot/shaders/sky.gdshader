// Céu: degradê azul, brilho do sol e nuvens procedurais (estáticas, baratas).
shader_type sky;

uniform vec3 top_col : source_color = vec3(0.15, 0.37, 0.74);
uniform vec3 mid_col : source_color = vec3(0.40, 0.61, 0.86);
uniform vec3 hor_col : source_color = vec3(0.74, 0.82, 0.90);
uniform vec3 ground_col : source_color = vec3(0.42, 0.44, 0.42);
uniform float cloud_cover = 0.48;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += vnoise(p) * a; p *= 2.03; a *= 0.5; } return s; }

void sky() {
	vec3 d = EYEDIR;
	float h = max(d.y, 0.0);
	vec3 c = mix(hor_col, mid_col, smoothstep(0.0, 0.2, h));
	c = mix(c, top_col, smoothstep(0.15, 0.9, h));
	if (d.y < 0.0) { c = mix(hor_col, ground_col, smoothstep(0.0, -0.25, d.y)); }
	float s = LIGHT0_ENABLED ? max(dot(d, LIGHT0_DIRECTION), 0.0) : 0.0;
	c += vec3(1.0, 0.92, 0.75) * (pow(s, 8.0) * 0.22 + pow(s, 1800.0) * 6.0);
	if (d.y > 0.0) {
		vec2 uv = d.xz / (d.y + 0.12) * 1.3;
		float n = fbm(uv * 2.0);
		float cl = smoothstep(1.0 - cloud_cover, 1.0 - cloud_cover + 0.32, n) * smoothstep(0.0, 0.18, d.y);
		float shade = fbm(uv * 2.0 + vec2(0.06, 0.03));
		vec3 ccol = mix(vec3(0.70, 0.73, 0.79), vec3(1.0), smoothstep(0.35, 0.75, shade)) * (1.0 + pow(s, 6.0) * 0.4);
		c = mix(c, ccol, cl * 0.95);
	}
	COLOR = c;
}

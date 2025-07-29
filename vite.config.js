import { defineConfig } from "vite";
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// https://vite.dev/config/
export default defineConfig(() => {
	return {
		plugins: [
			react(),
			viteStaticCopy({
				targets: [
					{
						src: 'src/figmation.png',
						dest: '.'
					},
					{
						src: 'src/assets/figmation.png',
						dest: 'assets'
					}
				]
			})
		]
	}
});

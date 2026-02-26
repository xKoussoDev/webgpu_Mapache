# 🦝 webgpu_Mapache

A WebGPU project built with **TypeScript + Vite** that renders a textured 3D object using modern GPU graphics programming.

This project demonstrates the use of **WebGPU**, **WGSL shaders**, buffers, textures, and the rendering pipeline in a simple and educational way.

---

## 📌 Features

- 3D rendering using WebGPU
- WGSL shaders (vertex + fragment)
- Texture mapping
- TypeScript-based structure
- Built with Vite
- Real-time rendering in browser

---

## 🧠 Technologies Used

- TypeScript  
- WGSL (WebGPU Shading Language)  
- Vite  
- Node.js  

---

## ⚙️ Prerequisites

Make sure you have the following installed:

- Node.js (LTS recommended)  
- Visual Studio Code  
- WebGPU compatible browser (latest Chrome or Edge)  
- VS Code "WebGPU" extension (optional but recommended for WGSL syntax highlighting)

---

# 🛠 Installation & Setup

## Part 1: Project Scaffolding (Terminal)

Open VS Code  
Open the integrated terminal (`Ctrl + \``)

Run the following commands:

```bash
# 1) Create project
npm create vite@latest webgpu_textured_cube -- --template vanilla-ts

# 2) Enter project folder
cd webgpu_textured_cube

# 3) Install dependencies
npm install
npm install --save-dev @webgpu/types

# 4) Start development server
npm run dev
```

---

## ▶️ Run the Project

After installation:

```bash
npm run dev
```

Then open in browser:

```
http://localhost:5173
```

Make sure you use a WebGPU-compatible browser.

---

---

## 👨‍💻 Author

Pablo Cisneros  
Artificial Intelligence Engineering Student  

GitHub: https://github.com/youruser  

---

## 📄 License

Educational project.

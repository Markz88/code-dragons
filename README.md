# Code & Dragons

**Code & Dragons** is an educational RPG that turns Python programming exercises into quests, character progression, and rewards.  
The project consists of:  
- a **FastAPI backend** that safely evaluates user-submitted code in a sandbox, and  
- a **vanilla JavaScript frontend** that provides the game interface via static pages.  

---

## ✨ Features
- **Story-driven progression** with chapters and levels defined in JSON, including narrative prompts and automated tests.  
- **Character creation** with roles, avatars, XP bar, dynamic achievements, and rewards.  
- **Game world extensions** such as a compendium, shop, and side quests served as additional static pages.  
- **Portable saves**: export and import local progress files (`*.pqs`) directly from the interface.  
- **Secure execution mode**: the backend uses `sandbox.py` to filter ASTs, block imports, and log test failures.  

---

## 🏗️ Architecture
- **`backend/`** – FastAPI app (`app.py`), JSON definitions for levels and achievements, execution sandbox, and Python dependencies.  
- **`frontend/`** – HTML/CSS/JS interface served as static files by the backend (`/static`). Includes avatar assets and pages for the compendium, shop, and side missions.  
- **`Dockerfile`** – Multi-stage build based on Python 3.12 that packages both backend and frontend.  

---

## 📦 Requirements
- Python 3.11+ (Python 3.12 recommended)  
- `pip` (virtual environments are optional but recommended)  
- Docker (optional, for containerized deployment)  

---

## 🚀 Quick Start (Development)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.app:app --reload --host 0.0.0.0 --port 8000
```

Open the game at [http://localhost:8000](http://localhost:8000).  

### Run with Docker
```bash
docker build -t code-and-dragons .
docker run --rm -p 8000:8000 code-and-dragons
```

The game will be available at [http://localhost:8000](http://localhost:8000).  

---

## 📂 Repository Structure
```
code&dragons/
├── backend/
│   ├── app.py
│   ├── sandbox.py
│   ├── levels.json
│   ├── achievements.json
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   └── ...
└── Dockerfile
```

---

## 🎨 Customizing Content
- Add new levels or chapters in `backend/levels.json` by updating the `meta.order` key and defining tests.  
- Manage achievements, roles, and supporting story elements in `backend/achievements.json`.  
- Update or add avatars, icons, and other assets in `frontend/assets/`.  
- To enable bug reporting via email, edit `frontend/app.js` and update the line:
  ```js
  const REPORT_EMAIL = 'support@example.com';
  ```

> ⚠️ Remember to restart the development server after modifying JSON files to reload the data.  

---

## 🛤️ Roadmap
- Add full English language support  
- Expand avatar set: provide 10 different avatars per role
- (Open to suggestions!)  

---

## 🤝 Contributing

We welcome contributions from the community! Here’s how you can help:  

1. **Fork the repository** and create a new branch for your changes.  
2. **Write clear, descriptive commit messages** so others understand the intent of your changes.  
3. **Ensure your code is tested** (e.g., add or update JSON levels, verify the sandbox works, etc.).  
4. **Open a Pull Request** with a detailed description of your changes.  
5. For bug fixes, please include a minimal example to reproduce the issue.  

👉 See the full [Contributing Guide](CONTRIBUTING.md) for details.  

### Reporting Issues
- Use the **GitHub Issues** tab to report bugs or request new features.  
- Before opening a new issue, please check if it has already been reported.  

### Ideas & Feedback
- Suggestions for new quests, levels, or features are encouraged!  
- If you’d like to discuss an idea before implementing it, open a **Discussion** or draft issue.  

---

## 📜 License

This project is licensed under the **MIT License**.

---

💡 Contributions, bug reports, and feature ideas are always welcome — let’s build **Code & Dragons** together!  

# Idea Builder

[![Support me on Patreon](https://img.shields.io/badge/Patreon-Support%20my%20work-FF424D?style=flat&logo=patreon&logoColor=white)](https://www.patreon.com/AndersBjarby)

A Flask web app for brainstorming on an interactive canvas. Enter a concept and the app uses OpenAI to spin off related ideas; pick two ideas and it generates a combined one. You can also paste a URL to pull in article text as a starting point, and tune the prompts and model in settings.

## What it does

- Generate 3 related ideas from any concept via OpenAI
- Combine two existing ideas into a new innovative one
- Fetch and extract readable text from a URL to seed ideas
- Configurable API key, model, system prompt, and generation/combination prompts (stored per session)

## Setup

```bash
pip install flask flask-sqlalchemy openai psycopg2-binary beautifulsoup4 requests email-validator
export FLASK_SECRET_KEY=your-secret
python main.py           # serves on http://0.0.0.0:80
```

Add your OpenAI API key and model in the in-app settings panel.

## Tech

Python, Flask, OpenAI Python SDK, BeautifulSoup. Bootstrap-based UI.

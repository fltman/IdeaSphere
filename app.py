import os
from flask import Flask, render_template, jsonify, request
from chat_request import send_openai_request

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "default_secret_key")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/generate-ideas', methods=['POST'])
def generate_ideas():
    main_idea = request.json.get('idea')
    
    # Check if this is a combination request
    if main_idea.startswith('Combine these two ideas:'):
        prompt = f"""Combine these two ideas into one innovative solution.
        Generate 3 possible combinations, focusing on how these ideas could work together.
        {main_idea}
        Respond in JSON format with the following structure:
        {{"ideas": [
            {{"text": "first combined idea"}},
            {{"text": "second combined idea"}},
            {{"text": "third combined idea"}}
        ]}}"""
    else:
        prompt = f"""Generate 3 related ideas for the concept: {main_idea}
        Respond in JSON format with the following structure:
        {{"ideas": [
            {{"text": "first related idea"}},
            {{"text": "second related idea"}},
            {{"text": "third related idea"}}
        ]}}"""
    
    try:
        response = send_openai_request(prompt)
        return jsonify({"success": True, "data": response})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

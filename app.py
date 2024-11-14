import os
from flask import Flask, render_template, jsonify, request, session
from chat_request import send_openai_request
import requests
from bs4 import BeautifulSoup
import urllib.parse


app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "default_secret_key")

# Add default settings
DEFAULT_SETTINGS = {
    "openai_api_key": "",
    "openai_model": "gpt-4o-mini",
    "system_prompt": "You are a brilliant inventor that generates ideas.",
    "combination_prompt": "Generate 1 possible combination, focusing on how these ideas could work together",
    "generation_prompt": "Generate 3 related ideas for the concept",
}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/update-settings', methods=['POST'])
def update_settings():
    settings = request.json
    session['user_settings'] = settings
    return jsonify({"success": True})

@app.route('/generate-ideas', methods=['POST'])
def generate_ideas():
    main_idea = request.json.get('idea')
    
    # Get user settings or use defaults
    settings = session.get('user_settings', DEFAULT_SETTINGS)
    
    if main_idea.startswith('Combine these two ideas:'):
        prompt = f"""Combine these two ideas into one innovative solution.
        {settings['combination_prompt']}.
        {main_idea}
        Respond in JSON format with the following structure:
        {{"ideas": [
            {{"text": "first combined idea"}},
        ]}}"""
    else:
        prompt = f"""{settings['generation_prompt']}: {main_idea}
        Respond in JSON format with the following structure:
        {{"ideas": [
            {{"text": "first related idea"}},
            {{"text": "second related idea"}},
            {{"text": "third related idea"}}
        ]}}"""
    
    try:
        print(f"Sending prompt: {prompt}")
        response = send_openai_request(prompt, settings.get('system_prompt'), settings.get('openai_api_key'), settings.get('openai_model'))
        print(f"Received response: {response}")
        return jsonify({"success": True, "data": response})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/fetch-url-content', methods=['POST'])
def fetch_url_content():
    data = request.json
    url = data.get('url')
    
    if not url:
        return jsonify({'error': 'No URL provided'}), 400
        
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        response.encoding = 'utf-8'
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # For ComputerSweden, look for specific article content
        article_content = []
        
        # Get the headline
        headline = soup.find('h1')
        if headline:
            article_content.append(headline.get_text().strip())
        
        # Get the main article content
        article = soup.find('article')
        if article:
            # Get all text content from the article
            for element in article.find_all(['p', 'h2', 'h3', 'ul', 'ol']):
                # Skip author info, dates, and other metadata
                if not any(skip in element.get_text().lower() for skip in ['av ', 'foto:', 'publicerad:', 'uppdaterad:']):
                    text = element.get_text().strip()
                    if text:
                        article_content.append(text)
        
        # Join all content with proper spacing
        text = '\n\n'.join(article_content)
        
        # Clean up text but preserve paragraphs
        text = '\n\n'.join(line.strip() for line in text.split('\n') if line.strip())
        
        # Increase max length significantly
        max_length = 5000  # Increased from 1000 to 5000
        if len(text) > max_length:
            # Try to cut at the end of a paragraph
            cutoff = text.rfind('\n', 0, max_length)
            if cutoff == -1:
                # If no paragraph break found, try to cut at a sentence
                cutoff = text.rfind('.', 0, max_length)
                if cutoff == -1:
                    cutoff = max_length
            text = text[:cutoff + 1].strip()
            text += '\n\n[...]'  # Add indication that content was truncated
            
        return jsonify({'content': text})
        
    except Exception as e:
        print(f"Error fetching URL: {str(e)}")  # Server-side logging
        return jsonify({'error': str(e)}), 500

@app.route('/get-settings')
def get_settings():
    return jsonify(session.get('user_settings', DEFAULT_SETTINGS))

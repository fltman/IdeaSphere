import os
from flask import Flask, render_template, jsonify, request, session
from chat_request import send_openai_request
import requests
from bs4 import BeautifulSoup
import urllib.parse
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "default_secret_key")

# Configure SQLite database
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///ideas.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Define database models
class Project(db.Model):
    __tablename__ = 'projects'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    ideas = db.relationship('Idea', backref='project', lazy=True, cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'created_at': self.created_at.isoformat()
        }

class Idea(db.Model):
    __tablename__ = 'ideas'
    
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    text = db.Column(db.Text, nullable=False)
    x_position = db.Column(db.Float)
    y_position = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    source_connections = db.relationship('Connection', 
                                     foreign_keys='Connection.source_id',
                                     backref='source', 
                                     lazy=True,
                                     cascade="all, delete-orphan")
    target_connections = db.relationship('Connection', 
                                     foreign_keys='Connection.target_id',
                                     backref='target', 
                                     lazy=True,
                                     cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            'id': self.id,
            'project_id': self.project_id,
            'text': self.text,
            'x_position': self.x_position,
            'y_position': self.y_position,
            'created_at': self.created_at.isoformat()
        }

class Connection(db.Model):
    __tablename__ = 'connections'
    
    id = db.Column(db.Integer, primary_key=True)
    source_id = db.Column(db.Integer, db.ForeignKey('ideas.id'), nullable=False)
    target_id = db.Column(db.Integer, db.ForeignKey('ideas.id'), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    project = db.relationship('Project')
    
    def to_dict(self):
        return {
            'id': self.id,
            'source_id': self.source_id,
            'target_id': self.target_id,
            'project_id': self.project_id,
            'created_at': self.created_at.isoformat()
        }

# Create database tables (if they don't exist)
with app.app_context():
    db.create_all()

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

# Project management endpoints
@app.route('/create-project', methods=['POST'])
def create_project():
    data = request.json
    project_name = data.get('name')
    
    if not project_name:
        return jsonify({"success": False, "error": "Project name is required"}), 400
    
    try:
        new_project = Project(name=project_name)
        db.session.add(new_project)
        db.session.commit()
        return jsonify({"success": True, "project": new_project.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/get-projects', methods=['GET'])
def get_projects():
    try:
        projects = Project.query.order_by(Project.created_at.desc()).all()
        return jsonify({"success": True, "projects": [p.to_dict() for p in projects]})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# Idea management endpoints
@app.route('/save-idea', methods=['POST'])
def save_idea():
    data = request.json
    idea_text = data.get('text')
    project_id = data.get('project_id')
    x_position = data.get('x_position')
    y_position = data.get('y_position')
    
    if not idea_text or not project_id:
        return jsonify({"success": False, "error": "Idea text and project ID are required"}), 400
    
    try:
        # Check if project exists
        project = Project.query.get(project_id)
        if not project:
            return jsonify({"success": False, "error": "Project not found"}), 404
            
        new_idea = Idea(
            text=idea_text,
            project_id=project_id,
            x_position=x_position,
            y_position=y_position
        )
        db.session.add(new_idea)
        db.session.commit()
        return jsonify({"success": True, "idea": new_idea.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/get-ideas', methods=['GET'])
def get_ideas():
    project_id = request.args.get('project_id')
    
    if not project_id:
        return jsonify({"success": False, "error": "Project ID is required"}), 400
    
    try:
        ideas = Idea.query.filter_by(project_id=project_id).order_by(Idea.created_at.asc()).all()
        return jsonify({"success": True, "ideas": [idea.to_dict() for idea in ideas]})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

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

@app.route('/update-idea-position', methods=['POST'])
def update_idea_position():
    data = request.json
    idea_id = data.get('id')
    project_id = data.get('project_id')
    x_position = data.get('x_position')
    y_position = data.get('y_position')
    
    if not idea_id or not project_id:
        return jsonify({"success": False, "error": "Idea ID and project ID are required"}), 400
    
    try:
        # Find the idea
        idea = Idea.query.get(idea_id)
        if not idea:
            return jsonify({"success": False, "error": "Idea not found"}), 404
            
        # Verify the idea belongs to the specified project
        if idea.project_id != int(project_id):
            return jsonify({"success": False, "error": "Idea does not belong to the specified project"}), 403
            
        # Update position
        idea.x_position = x_position
        idea.y_position = y_position
        db.session.commit()
        
        return jsonify({"success": True})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/save-connection', methods=['POST'])
def save_connection():
    data = request.json
    source_id = data.get('source_id')
    target_id = data.get('target_id')
    project_id = data.get('project_id')
    
    if not source_id or not target_id or not project_id:
        return jsonify({"success": False, "error": "Source ID, Target ID, and Project ID are required"}), 400
    
    try:
        # Check if connection already exists
        existing = Connection.query.filter_by(
            source_id=source_id, 
            target_id=target_id,
            project_id=project_id
        ).first()
        
        if existing:
            return jsonify({"success": True, "connection": existing.to_dict(), "message": "Connection already exists"})
        
        # Create new connection
        connection = Connection(
            source_id=source_id,
            target_id=target_id,
            project_id=project_id
        )
        
        db.session.add(connection)
        db.session.commit()
        
        return jsonify({"success": True, "connection": connection.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/get-connections', methods=['GET'])
def get_connections():
    project_id = request.args.get('project_id')
    
    if not project_id:
        return jsonify({"success": False, "error": "Project ID is required"}), 400
    
    try:
        connections = Connection.query.filter_by(project_id=project_id).all()
        return jsonify({
            "success": True, 
            "connections": [connection.to_dict() for connection in connections]
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

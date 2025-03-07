# IdeaSphere

A visual brainstorming and idea generation tool powered by AI.

## Description

IdeaSphere is an interactive web application for creating, organizing, and developing ideas. It provides a visual workspace where you can place ideas, connect them, and use AI to generate related concepts or combine existing ideas.

## Features

- Interactive visual workspace for organizing ideas
- AI-powered idea generation and combination via OpenAI integration
- URL content extraction for quickly adding ideas from web sources
- Timer functionality for timed brainstorming sessions
- Customizable AI behavior through settings
- Idea history tracking

## Installation

### Prerequisites

- Python 3.11 or higher
- OpenAI API key (for AI features)

### Setup

1. Clone this repository:
   ```
   git clone <repository-url>
   cd IdeaSphere
   ```

2. Create and activate a virtual environment (recommended):
   ```
   # On macOS/Linux
   python -m venv venv
   source venv/bin/activate

   # On Windows
   python -m venv venv
   venv\Scripts\activate
   ```

3. Install the required dependencies:
   ```
   pip install -r requirements.txt
   ```

## Usage

1. Start the application:
   ```
   python main.py
   ```

2. Open your web browser and navigate to:
   ```
   http://localhost:5001
   ```

3. On first launch, enter your OpenAI API key in the settings panel (⚙️)

### Basic Workflow

1. Click anywhere on the workspace to add a new idea
2. Enter text or paste a URL to extract content
3. Drag ideas to position them on the workspace
4. Select two ideas to combine them using AI
5. Use the timer for timed brainstorming sessions

### Controls

- **⚙️ Button**: Toggle settings panel
- **Hide History**: Toggle ideas history panel
- **Timer Controls**: Set duration and control timed sessions
- **Clear Button**: Remove all ideas from the workspace

## Troubleshooting

- If you encounter module not found errors, ensure you're running the application from the virtual environment where dependencies were installed
- Check that your OpenAI API key is valid if AI-related features aren't working

## License

Copyright © 2024 Anders Bjarby - CC-BY 
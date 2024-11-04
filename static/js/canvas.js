class CanvasManager {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.ideas = [];
        this.selectedIdea = null;
        this.isDragging = false;
        this.connections = [];

        this.resizeCanvas();
        this.setupEventListeners();
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.resizeCanvas());
        
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
    }

    drawIdea(idea) {
        this.ctx.beginPath();
        this.ctx.arc(idea.x, idea.y, 40, 0, Math.PI * 2);
        this.ctx.fillStyle = idea.isAIGenerated ? '#4a5' : '#458';
        this.ctx.fill();
        
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(idea.text, idea.x, idea.y);
    }

    drawConnections() {
        this.ctx.strokeStyle = '#666';
        this.ctx.lineWidth = 2;

        this.connections.forEach(conn => {
            this.ctx.beginPath();
            this.ctx.moveTo(conn.from.x, conn.from.y);
            this.ctx.lineTo(conn.to.x, conn.to.y);
            this.ctx.stroke();
        });
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawConnections();
        this.ideas.forEach(idea => this.drawIdea(idea));
    }

    addIdea(x, y, text, isAIGenerated = false) {
        const idea = { x, y, text, isAIGenerated };
        this.ideas.push(idea);
        return idea;
    }

    connectIdeas(idea1, idea2) {
        this.connections.push({ from: idea1, to: idea2 });
    }

    getIdeaAtPosition(x, y) {
        return this.ideas.find(idea => {
            const dx = idea.x - x;
            const dy = idea.y - y;
            return Math.sqrt(dx * dx + dy * dy) < 40;
        });
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const clickedIdea = this.getIdeaAtPosition(x, y);
        if (clickedIdea) {
            this.selectedIdea = clickedIdea;
            this.isDragging = true;
        }
    }

    handleMouseMove(e) {
        if (!this.isDragging || !this.selectedIdea) return;

        const rect = this.canvas.getBoundingClientRect();
        this.selectedIdea.x = e.clientX - rect.left;
        this.selectedIdea.y = e.clientY - rect.top;
        this.render();
    }

    handleMouseUp() {
        this.isDragging = false;
        this.selectedIdea = null;
    }
}

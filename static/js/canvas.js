class CanvasManager {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.ideas = [];
        this.selectedIdea = null;
        this.isDragging = false;
        this.connections = [];
        this.tooltip = this.createTooltip();
        this.setupCanvas();
        this.setupEventListeners();
    }

    createTooltip() {
        const tooltip = document.createElement('div');
        tooltip.className = 'idea-tooltip';
        tooltip.style.display = 'none';
        this.canvas.parentElement.appendChild(tooltip);
        return tooltip;
    }

    setupCanvas() {
        const container = this.canvas.parentElement;
        const headerHeight = document.querySelector('header').offsetHeight;
        const controlsHeight = document.querySelector('.controls').offsetHeight;
        const availableHeight = window.innerHeight - headerHeight - controlsHeight;
        
        // Make the canvas large enough to accommodate ideas
        this.canvas.width = Math.max(window.innerWidth * 2, 3000);
        this.canvas.height = Math.max(availableHeight * 2, 3000);
        
        // Center the viewport
        container.scrollLeft = (this.canvas.width - container.clientWidth) / 2;
        container.scrollTop = (this.canvas.height - container.clientHeight) / 2;
    }

    setupEventListeners() {
        window.addEventListener('resize', () => {
            this.setupCanvas();
            this.render();
        });
        
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        
        this.canvas.addEventListener('mousemove', (e) => this.updateTooltip(e));
        this.canvas.addEventListener('mouseleave', () => this.hideTooltip());
    }

    updateTooltip(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left + this.canvas.parentElement.scrollLeft;
        const y = e.clientY - rect.top + this.canvas.parentElement.scrollTop;
        
        const idea = this.getIdeaAtPosition(x, y);
        if (idea) {
            this.tooltip.textContent = idea.text;
            this.tooltip.style.display = 'block';
            this.tooltip.style.left = (e.clientX + 10) + 'px';
            this.tooltip.style.top = (e.clientY + 10) + 'px';
        } else {
            this.hideTooltip();
        }
    }

    hideTooltip() {
        this.tooltip.style.display = 'none';
    }

    drawIdea(idea) {
        this.ctx.beginPath();
        this.ctx.arc(idea.x, idea.y, 40, 0, Math.PI * 2);
        this.ctx.fillStyle = idea.isAIGenerated ? '#4a5' : '#458';
        this.ctx.fill();
        
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'center';
        const shortText = idea.text.length > 20 ? idea.text.substring(0, 17) + '...' : idea.text;
        this.ctx.fillText(shortText, idea.x, idea.y);
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
        const x = e.clientX - rect.left + this.canvas.parentElement.scrollLeft;
        const y = e.clientY - rect.top + this.canvas.parentElement.scrollTop;

        const clickedIdea = this.getIdeaAtPosition(x, y);
        if (clickedIdea) {
            this.selectedIdea = clickedIdea;
            this.isDragging = true;
        }
    }

    handleMouseMove(e) {
        if (!this.isDragging || !this.selectedIdea) return;

        const rect = this.canvas.getBoundingClientRect();
        this.selectedIdea.x = e.clientX - rect.left + this.canvas.parentElement.scrollLeft;
        this.selectedIdea.y = e.clientY - rect.top + this.canvas.parentElement.scrollTop;
        this.render();
    }

    handleMouseUp() {
        this.isDragging = false;
        this.selectedIdea = null;
    }

    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left + this.canvas.parentElement.scrollLeft;
        const y = e.clientY - rect.top + this.canvas.parentElement.scrollTop;
        
        const clickedIdea = this.getIdeaAtPosition(x, y);
        if (!clickedIdea) {
            document.dispatchEvent(new CustomEvent('canvas-click', {
                detail: { x, y }
            }));
        }
    }
}

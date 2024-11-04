class CanvasManager {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.ideas = [];
        this.selectedIdea = null;
        this.isDragging = false;
        this.connections = [];
        this.tooltip = this.createTooltip();
        this.isPermanentTooltip = false;
        console.log('CanvasManager initialized');
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

    getViewportCenter() {
        const container = this.canvas.parentElement;
        return {
            x: container.scrollLeft + container.clientWidth / 2,
            y: container.scrollTop + container.clientHeight / 2
        };
    }

    centerOnPoint(x, y) {
        const container = this.canvas.parentElement;
        container.scrollTo({
            left: x - container.clientWidth / 2,
            top: y - container.clientHeight / 2,
            behavior: 'smooth'
        });
    }

    setupCanvas() {
        const container = this.canvas.parentElement;
        const headerHeight = document.querySelector('header').offsetHeight;
        const controlsHeight = document.querySelector('.controls').offsetHeight;
        const availableHeight = window.innerHeight - headerHeight - controlsHeight;
        
        this.canvas.width = Math.max(window.innerWidth * 2, 3000);
        this.canvas.height = Math.max(availableHeight * 2, 3000);
        
        const center = this.getViewportCenter();
        container.scrollLeft = (this.canvas.width - container.clientWidth) / 2;
        container.scrollTop = (this.canvas.height - container.clientHeight) / 2;
        
        console.log('Canvas setup complete:', {
            width: this.canvas.width,
            height: this.canvas.height,
            scroll: { x: container.scrollLeft, y: container.scrollTop }
        });
    }

    setupEventListeners() {
        window.addEventListener('resize', () => {
            console.log('Window resized');
            this.setupCanvas();
            this.render();
        });
        
        this.canvas.addEventListener('mousedown', (e) => {
            this.handleMouseDown(e);
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                this.handleMouseMove(e);
            } else if (!this.isPermanentTooltip) {
                this.updateTooltip(e);
            }
        });
        
        this.canvas.addEventListener('mouseup', (e) => {
            this.handleMouseUp(e);
        });
        
        this.canvas.addEventListener('click', (e) => {
            this.handleClick(e);
        });
        
        this.canvas.addEventListener('mouseleave', () => {
            if (!this.isPermanentTooltip) {
                this.hideTooltip();
            }
        });

        document.addEventListener('click', (e) => {
            if (!this.canvas.contains(e.target) && this.isPermanentTooltip) {
                this.isPermanentTooltip = false;
                this.hideTooltip();
            }
        });
    }

    updateTooltip(e, forceShow = false) {
        const rect = this.canvas.getBoundingClientRect();
        const container = this.canvas.parentElement;
        const x = e.clientX - rect.left + container.scrollLeft;
        const y = e.clientY - rect.top + container.scrollTop;
        
        const idea = this.getIdeaAtPosition(x, y);
        if (idea) {
            this.tooltip.textContent = idea.text;
            this.tooltip.style.display = 'block';
            
            const tooltipX = e.clientX + 10;
            const tooltipY = e.clientY + 10;
            
            const tooltipRect = this.tooltip.getBoundingClientRect();
            if (tooltipX + tooltipRect.width > window.innerWidth) {
                this.tooltip.style.left = (e.clientX - tooltipRect.width - 10) + 'px';
            } else {
                this.tooltip.style.left = tooltipX + 'px';
            }
            
            if (tooltipY + tooltipRect.height > window.innerHeight) {
                this.tooltip.style.top = (e.clientY - tooltipRect.height - 10) + 'px';
            } else {
                this.tooltip.style.top = tooltipY + 'px';
            }

            if (forceShow) {
                this.isPermanentTooltip = true;
            }
        } else if (!this.isPermanentTooltip) {
            this.hideTooltip();
        }
    }

    hideTooltip() {
        this.tooltip.style.display = 'none';
        this.isPermanentTooltip = false;
    }

    drawIdea(idea) {
        this.ctx.beginPath();
        this.ctx.arc(idea.x, idea.y, 60, 0, Math.PI * 2);
        this.ctx.fillStyle = idea.isAIGenerated ? '#98FB98' : '#6495ED';
        this.ctx.fill();
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '18px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
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
        this.centerOnPoint(x, y);
        return idea;
    }

    connectIdeas(idea1, idea2) {
        this.connections.push({ from: idea1, to: idea2 });
    }

    getIdeaAtPosition(x, y) {
        const clickRadius = 60;
        return this.ideas.find(idea => {
            const dx = idea.x - x;
            const dy = idea.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance <= clickRadius;
        });
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const container = this.canvas.parentElement;
        const x = e.clientX - rect.left + container.scrollLeft;
        const y = e.clientY - rect.top + container.scrollTop;
        
        const clickedIdea = this.getIdeaAtPosition(x, y);
        if (clickedIdea) {
            e.stopPropagation(); // Prevent modal from showing
            this.selectedIdea = clickedIdea;
            this.isDragging = true;
            console.log('Starting drag operation:', clickedIdea);
        }
    }

    handleMouseMove(e) {
        if (!this.isDragging || !this.selectedIdea) {
            return;
        }

        const rect = this.canvas.getBoundingClientRect();
        const container = this.canvas.parentElement;
        const newX = e.clientX - rect.left + container.scrollLeft;
        const newY = e.clientY - rect.top + container.scrollTop;
        
        this.selectedIdea.x = newX;
        this.selectedIdea.y = newY;
        this.render();
    }

    handleMouseUp(e) {
        if (this.isDragging && this.selectedIdea) {
            console.log('Finished dragging idea:', this.selectedIdea);
            this.centerOnPoint(this.selectedIdea.x, this.selectedIdea.y);
        }
        this.isDragging = false;
        this.selectedIdea = null;
    }

    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const container = this.canvas.parentElement;
        const x = e.clientX - rect.left + container.scrollLeft;
        const y = e.clientY - rect.top + container.scrollTop;
        
        const clickedIdea = this.getIdeaAtPosition(x, y);
        console.log('Canvas clicked:', { x, y, clickedIdea });
        
        if (clickedIdea) {
            // Show tooltip for clicked idea
            this.updateTooltip(e, true);
            e.stopPropagation(); // Prevent modal from showing
            return;
        }
        
        if (!this.isDragging) {
            // Only dispatch event for creating new idea if not dragging and not clicking existing idea
            console.log('Dispatching canvas-click event for new idea:', { x, y });
            const event = new CustomEvent('canvas-click', {
                detail: { x, y }
            });
            document.dispatchEvent(event);
        }
    }
}

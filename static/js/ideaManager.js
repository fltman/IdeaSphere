[Previous content remains the same until line 432...]

                    const x = parseInt(idea.element.style.left) + radius * Math.cos(angle);
                    const y = parseInt(idea.element.style.top) + radius * Math.sin(angle);
                    
                    const newIdea = this.addIdea(x, y, relatedIdea.text, true);
                    this.connectIdeas(idea, newIdea);
                });
            }
        } catch (error) {
            console.error('Error generating related ideas:', error);
            ideaBall.classList.remove('generating');
        }
    }

    clearWorkspace() {
        while (this.workspace.firstChild) {
            this.workspace.removeChild(this.workspace.firstChild);
        }
        this.ideas = [];
        this.connections = [];
        this.drawConnections();
    }

    addToHistory(text, isGenerated = true) {
        if (isGenerated) {
            this.generatedIdeas.unshift(text);
            if (this.generatedIdeas.length > this.maxHistoryItems) {
                this.generatedIdeas.pop();
            }
            this.updateHistoryList();
        }
    }

    updateHistoryList() {
        const list = document.getElementById('ideas-list');
        if (!list) return;
        
        list.innerHTML = '';
        this.generatedIdeas.forEach(text => {
            const li = document.createElement('li');
            li.textContent = text;
            list.appendChild(li);
        });
    }

    showTooltip(ideaBall, text) {
        const existingTooltip = ideaBall.querySelector('.idea-tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
            return;
        }
        
        document.querySelectorAll('.idea-tooltip').forEach(tooltip => tooltip.remove());
        
        const tooltip = document.createElement('div');
        tooltip.className = 'idea-tooltip';
        tooltip.textContent = text;
        tooltip.style.left = '130px';
        tooltip.style.top = '50%';
        tooltip.style.transform = 'translateY(-50%)';
        ideaBall.appendChild(tooltip);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded');
    const ideaManager = new IdeaManager('idea-workspace');
    const ideaModal = new bootstrap.Modal(document.getElementById('ideaModal'));
    const generateIdeasBtn = document.getElementById('generateIdeas');
    const clearCanvasBtn = document.getElementById('clearCanvas');
    let pendingIdeaPosition = null;

    document.addEventListener('workspace-click', function(e) {
        console.log('Workspace click event received:', e.detail);
        pendingIdeaPosition = { x: e.detail.x, y: e.detail.y };
        ideaModal.show();
    });

    document.getElementById('saveIdea').addEventListener('click', function() {
        const ideaInput = document.getElementById('ideaInput');
        const ideaText = ideaInput.value.trim();
        console.log('Save idea clicked:', { ideaText, position: pendingIdeaPosition });
        
        if (ideaText && pendingIdeaPosition) {
            const newIdea = ideaManager.addIdea(
                pendingIdeaPosition.x,
                pendingIdeaPosition.y,
                ideaText
            );
            console.log('New idea created:', newIdea);
            generateIdeasBtn.disabled = false;
            ideaInput.value = '';
            ideaModal.hide();
            pendingIdeaPosition = null;
        } else {
            console.warn('Cannot save idea: missing text or position');
        }
    });

    generateIdeasBtn.addEventListener('click', async function() {
        const mainIdea = ideaManager.ideas.find(idea => !idea.isAIGenerated);
        console.log('Generate ideas clicked, main idea:', mainIdea);
        
        if (!mainIdea) {
            console.warn('No main idea found for generation');
            return;
        }

        try {
            console.log('Sending request to generate ideas for:', mainIdea.text);
            const response = await fetch('/generate-ideas', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ idea: mainIdea.text })
            });

            const data = await response.json();
            console.log('Received response:', data);
            
            if (data.success) {
                const relatedIdeas = JSON.parse(data.data).ideas;
                const radius = 200;
                const angleStep = (2 * Math.PI) / relatedIdeas.length;

                relatedIdeas.forEach((idea, index) => {
                    const angle = index * angleStep;
                    const rect = mainIdea.element.getBoundingClientRect();
                    const x = parseInt(mainIdea.element.style.left) + radius * Math.cos(angle);
                    const y = parseInt(mainIdea.element.style.top) + radius * Math.sin(angle);
                    
                    console.log('Creating related idea:', { text: idea.text, x, y });
                    const newIdea = ideaManager.addIdea(x, y, idea.text, true);
                    ideaManager.connectIdeas(mainIdea, newIdea);
                });

                generateIdeasBtn.disabled = true;
                ideaManager.centerOnPoint(parseInt(mainIdea.element.style.left), parseInt(mainIdea.element.style.top));
            }
        } catch (error) {
            console.error('Error generating ideas:', error);
        }
    });

    clearCanvasBtn.addEventListener('click', function() {
        console.log('Clearing workspace');
        ideaManager.clearWorkspace();
        generateIdeasBtn.disabled = true;
    });
});

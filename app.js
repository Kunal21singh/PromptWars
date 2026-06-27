// ChefFlow AI — Application State & API Integration

// =========================================================================
// CONFIGURATION: The Gemini API key should be entered by the user at runtime.
// Storing it in the browser is acceptable for client-side demos but never hardcode secrets in source files.
const HARDCODED_API_KEY = '';
// =========================================================================

// INITIAL STATE
let state = {
    apiKey: localStorage.getItem('chefflow_api_key') || HARDCODED_API_KEY || '',
    model: localStorage.getItem('chefflow_model') || 'gemini-1.5-flash-latest',
    mealData: null,
    checkedTodos: {},
    checkedGrocery: {},
    customGrocery: []
};

// DOM ELEMENTS
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const modalClose = document.getElementById('modal-close');
const apiKeyInput = document.getElementById('api-key-input');
const modelSelect = document.getElementById('model-select');
const saveKeyBtn = document.getElementById('save-key-btn');
const testKeyBtn = document.getElementById('test-key-btn');
const keyTestStatus = document.getElementById('key-test-status');

const plannerForm = document.getElementById('planner-form');
const scheduleInput = document.getElementById('schedule-input');
const dietInput = document.getElementById('diet-input');
const budgetLevelSelect = document.getElementById('budget-level');
const budgetTargetInput = document.getElementById('budget-target');
const generateBtn = document.getElementById('generate-btn');

const loadingState = document.getElementById('loading-state');
const loadingMessage = document.getElementById('loading-message');
const loadingProgressBar = document.getElementById('loading-progress-bar');
const errorCard = document.getElementById('error-card');
const errorMessage = document.getElementById('error-message');
const errorRetryBtn = document.getElementById('error-retry-btn');

const dashboardContainer = document.getElementById('dashboard-container');
const resetAppBtn = document.getElementById('reset-app-btn');

// EVENT LISTENERS INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    // Load Saved Configurations
    if (state.apiKey) {
        apiKeyInput.value = state.apiKey;
    }
    modelSelect.value = state.model;

    // Suggestion tags helper
    document.querySelectorAll('.suggestion-tag').forEach(tag => {
        tag.addEventListener('click', () => {
            scheduleInput.value = getSuggestionText(tag.textContent);
        });
    });

    // Modal Control
    settingsBtn.addEventListener('click', openSettingsModal);
    modalClose.addEventListener('click', closeSettingsModal);
    saveKeyBtn.addEventListener('click', saveSettings);
    testKeyBtn.addEventListener('click', testApiKey);

    // Form submission
    plannerForm.addEventListener('submit', handleFormSubmit);
    errorRetryBtn.addEventListener('click', handleFormSubmit);

    // Meal Plan Tabs
    document.querySelectorAll('.meal-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.meal-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.meal-panel').forEach(p => p.classList.remove('active'));
            
            tab.classList.add('active');
            const panelId = `${tab.dataset.meal}-panel`;
            document.getElementById(panelId).classList.add('active');
        });
    });

    // Custom grocery additions
    document.getElementById('add-grocery-btn').addEventListener('click', addCustomGroceryItem);
    document.getElementById('custom-grocery-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addCustomGroceryItem();
    });

    // Reset button
    resetAppBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('Are you sure you want to reset ChefFlow and clear your current plan progress? (Your API Key will not be deleted)')) {
            clearCachedPlan();
        }
    });

    // Auto-load cached plan on start if it exists
    loadCachedPlan();
});

// SUGGESTIONS DB
function getSuggestionText(tagText) {
    if (tagText.includes('workday')) {
        return "Busy remote workday. Zoom meetings from 9:30 AM to 1:00 PM, then a gym workout at 5:30 PM. Need a quick lunch under 20 mins, and dinner ready by 7:00 PM for 2 people. I want to cook something rewarding but not too heavy.";
    } else if (tagText.includes('weekend')) {
        return "Relaxed Sunday. Family coming over (4 people total) around 1:30 PM. I want to spend up to 2 hours prepping a beautiful, slow-cooked Mediterranean lunch or dinner, and keep breakfast super light.";
    } else if (tagText.includes('workout')) {
        return "Double training day. Heavy strength session at 8 AM and run at 6 PM. Need high-protein, calorie-dense foods that require minimal cleanup between my busy study periods.";
    }
    return "";
}

// SETTINGS MODAL CONTROL
function openSettingsModal() {
    settingsModal.classList.add('active');
    keyTestStatus.classList.add('hidden');
}

function closeSettingsModal() {
    settingsModal.classList.remove('active');
}

function saveSettings() {
    const key = apiKeyInput.value.trim();
    const model = modelSelect.value;
    
    state.apiKey = key;
    state.model = model;
    
    localStorage.setItem('chefflow_api_key', key);
    localStorage.setItem('chefflow_model', model);
    
    closeSettingsModal();
}

// TEST API KEY
async function testApiKey() {
    const key = apiKeyInput.value.trim();
    if (!key) {
        showKeyStatus('Please enter an API key first.', 'error');
        return;
    }
    
    showKeyStatus('Testing API Key connectivity...', 'loading');
    
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelSelect.value)}:generateContent?key=${encodeURIComponent(key)}`, {
            method: 'POST',
            credentials: 'omit',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Respond with only the word 'Success'" }] }]
            })
        });
        
        const data = await response.json();
        if (response.ok && data.candidates && data.candidates[0].content.parts[0].text) {
            showKeyStatus('Connection Successful! Your API key is valid.', 'success');
        } else {
            const errMsg = data.error?.message || 'Invalid API key or model mismatch.';
            showKeyStatus(`Connection Failed: ${errMsg}`, 'error');
        }
    } catch (err) {
        showKeyStatus(`Connection Error: ${err.message}`, 'error');
    }
}

function showKeyStatus(msg, type) {
    keyTestStatus.className = 'status-msg';
    keyTestStatus.classList.remove('hidden');
    keyTestStatus.textContent = msg;
    
    if (type === 'success') {
        keyTestStatus.classList.add('success');
    } else if (type === 'error') {
        keyTestStatus.classList.add('error');
    } else {
        keyTestStatus.style.background = 'rgba(255,255,255,0.05)';
        keyTestStatus.style.color = 'var(--text-secondary)';
    }
}

// MAIN SUBMIT HANDLER
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const schedule = scheduleInput.value.trim();
    const diet = dietInput.value;
    const budgetLevel = budgetLevelSelect.value;
    const budgetTarget = parseFloat(budgetTargetInput.value) || 30.00;

    if (!schedule) return;

    // Check if key is configured, if not, ask for demo mode
    if (!state.apiKey) {
        const useDemo = confirm("No Gemini API key configured. ChefFlow can generate a simulated plan in Demo Mode so you can explore the premium layout and interaction. Would you like to use Demo Mode?\n\n(To add your own key, click the settings gear in the top right.)");
        if (useDemo) {
            runDemoMode(schedule, diet, budgetLevel, budgetTarget);
            return;
        } else {
            openSettingsModal();
            return;
        }
    }

    // Toggle states
    errorCard.classList.add('hidden');
    dashboardContainer.classList.add('hidden');
    loadingState.classList.remove('hidden');
    generateBtn.disabled = true;

    // Animate fake progress text steps
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += 5;
        if (progress > 95) progress = 95;
        loadingProgressBar.style.width = `${progress}%`;
    }, 400);

    const steps = [
        "Analyzing your day's schedule...",
        "Structuring morning, afternoon, and dinner preps...",
        "Formulating recipes matching your dietary rules...",
        "Checking regional grocery pricing guidelines...",
        "Optimizing kitchen timeline overlaps...",
        "Finalizing budget feasibility analytics..."
    ];
    let stepIdx = 0;
    loadingMessage.textContent = steps[stepIdx];
    const messageInterval = setInterval(() => {
        stepIdx = (stepIdx + 1) % steps.length;
        loadingMessage.textContent = steps[stepIdx];
    }, 2500);

    try {
        const responseData = await queryGeminiAPI(schedule, diet, budgetLevel, budgetTarget);
        
        // Success
        clearInterval(progressInterval);
        clearInterval(messageInterval);
        loadingProgressBar.style.width = '100%';
        
        setTimeout(() => {
            try {
                loadingState.classList.add('hidden');
                generateBtn.disabled = false;
                
                // Set data
                state.mealData = responseData;
                state.checkedTodos = {};
                state.checkedGrocery = {};
                state.customGrocery = [];
                
                saveCachedPlan();
                renderDashboard();
            } catch (renderErr) {
                console.error("Dashboard rendering failed:", renderErr);
                showRenderError(renderErr);
            }
        }, 500);
        
    } catch (err) {
        clearInterval(progressInterval);
        clearInterval(messageInterval);
        loadingState.classList.add('hidden');
        generateBtn.disabled = false;
        
        errorCard.classList.remove('hidden');
        errorMessage.textContent = err.message || "Failed to contact Gemini API. Please review your network or try again.";
    }
}

// RENDERING ERROR HANDLER
function showRenderError(err) {
    loadingState.classList.add('hidden');
    generateBtn.disabled = false;
    errorCard.classList.remove('hidden');
    errorMessage.textContent = `Rendering error: ${err.message}. (The AI returned incomplete layout fields). Try re-running.`;
}

// STRIP MARKDOWN BLOCK FENCES FROM RESPONSE TEXT
function cleanJSONResponse(text) {
    let cleanText = text.trim();
    if (cleanText.startsWith("```")) {
        cleanText = cleanText.replace(/^```(json)?\s*/i, "");
        cleanText = cleanText.replace(/\s*```$/, "");
    }
    return cleanText.trim();
}

// QUERY GEMINI API WITH AUTOMATIC RESILIENT FALLBACKS
async function queryGeminiAPI(schedule, diet, budgetLevel, budgetTarget) {
    // Compressed, highly token-efficient prompt
    const prompt = `You are ChefFlow, a meal planning assistant.
Generate a structured JSON daily meal plan, shopping list, swaps, prep timeline, and budget feasibility checks.

USER SPECS:
- Day/Schedule: "${schedule}"
- Diet: "${diet}"
- Budget level: "${budgetLevel}"
- Cost limit: $${budgetTarget}

Output ONLY valid JSON matching this schema. NO markdown wrap. Keep descriptions (1-2 sentences) and steps short to save tokens.
{
  "meals": {
    "breakfast": { "name": "", "prepTime": "", "cookTime": "", "description": "", "ingredients": [], "instructions": [] },
    "lunch": { "name": "", "prepTime": "", "cookTime": "", "description": "", "ingredients": [], "instructions": [] },
    "dinner": { "name": "", "prepTime": "", "cookTime": "", "description": "", "ingredients": [], "instructions": [] }
  },
  "groceryList": [
    { "name": "", "category": "Produce|Protein|Pantry|Dairy|Bakery|Other", "quantity": "", "estimatedCost": 0.00 }
  ],
  "substitutions": [
    { "original": "", "substitutedWith": "", "reason": "" }
  ],
  "cookingTodoList": [
    { "timeframe": "Morning Prep|Mid-day Prep|30 Mins Before|Active Cooking|Post-Cooking", "step": "", "associatedMeal": "" }
  ],
  "budgetFeasibility": {
    "totalEstimatedCost": 0.00,
    "status": "Within Budget|Slightly Over Budget|Over Budget",
    "analysis": "",
    "savingsTips": []
  }
}`;

    // Define resilient fallback model chain prioritizing stable/low-token models
    const modelsToTry = [state.model];
    const allModels = ['gemini-1.5-flash-latest', 'gemini-1.5-flash-8b', 'gemini-2.5-flash', 'gemini-2.0-flash'];
    allModels.forEach(m => {
        if (!modelsToTry.includes(m)) {
            modelsToTry.push(m);
        }
    });

    let lastError = null;

    for (let i = 0; i < modelsToTry.length; i++) {
        const currentModel = modelsToTry[i];
        
        if (i > 0) {
            console.warn(`Primary model failed. Attempting fallback model: ${currentModel}`);
            const loadingMsgEl = document.getElementById('loading-message');
            if (loadingMsgEl) {
                loadingMsgEl.textContent = `High demand on primary model. Trying fallback (${currentModel})...`;
            }
        }

        try {
            const apiURL = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${state.apiKey}`;
            const response = await fetch(apiURL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [
                        {
                            role: "user",
                            parts: [
                                {
                                    text: prompt
                                }
                            ]
                        }
                    ],
                    generationConfig: {
                        responseMimeType: "application/json"
                    }
                })
            });

            const data = await response.json();
            
            if (!response.ok) {
                const errMsg = data.error?.message || `HTTP error! status: ${response.status}`;
                const isOverload = errMsg.toLowerCase().includes('high demand') || 
                                   errMsg.toLowerCase().includes('quota') || 
                                   errMsg.toLowerCase().includes('limit') || 
                                   errMsg.toLowerCase().includes('overloaded') ||
                                   errMsg.toLowerCase().includes('not found') ||
                                   response.status === 400 ||
                                   response.status === 429 || 
                                   response.status === 503;
                
                if (isOverload && i < modelsToTry.length - 1) {
                    lastError = new Error(errMsg);
                    continue; // Try next fallback model
                }
                throw new Error(errMsg);
            }

            const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!jsonText) {
                throw new Error("Empty response received from Gemini.");
            }

            return JSON.parse(cleanJSONResponse(jsonText));

        } catch (err) {
            const errMsg = (err.message || '').toLowerCase();
            const isOverloadErr = errMsg.includes('high demand') || 
                                  errMsg.includes('quota') || 
                                  errMsg.includes('limit') || 
                                  errMsg.includes('not found') ||
                                  errMsg.includes('overloaded');
            
            if (isOverloadErr && i < modelsToTry.length - 1) {
                lastError = err;
                continue; // Try next fallback model
            }
            throw err;
        }
    }

    throw lastError || new Error("Failed to contact Gemini after attempting all fallback models.");
}


// RENDERING LOGIC
function renderDashboard() {
    if (!state.mealData) return;

    const data = state.mealData;

    // 1. MEAL PLAN RENDER
    if (data.meals) {
        renderMeal('breakfast', data.meals.breakfast);
        renderMeal('lunch', data.meals.lunch);
        renderMeal('dinner', data.meals.dinner);
    }
    
    // Reset active tabs on redraw
    document.querySelectorAll('.meal-tab').forEach((t, i) => {
        if (i === 0) t.classList.add('active');
        else t.classList.remove('active');
    });
    document.querySelectorAll('.meal-panel').forEach((p, i) => {
        if (i === 0) p.classList.add('active');
        else p.classList.remove('active');
    });

    // 2. BUDGET FEASIBILITY RENDER
    const budgetFeas = data.budgetFeasibility || {};
    const totalCost = budgetFeas.totalEstimatedCost || 0.00;
    const targetCost = parseFloat(budgetTargetInput.value) || 30.00;
    
    document.getElementById('gauge-cost-val').textContent = `$${totalCost.toFixed(2)}`;
    document.getElementById('budget-est-val').textContent = `$${totalCost.toFixed(2)}`;
    document.getElementById('budget-limit-val').textContent = `$${targetCost.toFixed(2)}`;
    
    // Gauge Animation (SVG stroke-dashoffset)
    // Circumference = 264. Math is: 264 - (ratio * 264)
    const ratio = Math.min(totalCost / targetCost, 1.0);
    const dashoffset = 264 - (ratio * 264);
    const gaugeFill = document.getElementById('gauge-fill');
    gaugeFill.style.strokeDashoffset = dashoffset;

    // Gauge Colors & Glow Badge
    const budgetBadge = document.getElementById('budget-badge');
    budgetBadge.textContent = budgetFeas.status || 'Unknown';
    
    if (totalCost <= targetCost) {
        gaugeFill.style.stroke = 'var(--primary-color)';
        budgetBadge.className = 'budget-badge-status green-glow';
    } else if (totalCost <= targetCost * 1.2) {
        gaugeFill.style.stroke = 'var(--secondary-color)';
        budgetBadge.className = 'budget-badge-status yellow-glow';
    } else {
        gaugeFill.style.stroke = 'var(--danger-color)';
        budgetBadge.className = 'budget-badge-status red-glow';
    }

    document.getElementById('budget-analysis-text').textContent = budgetFeas.analysis || '';

    // Budget Tips
    const tipsList = document.getElementById('budget-tips-list');
    tipsList.innerHTML = '';
    const savingsTips = budgetFeas.savingsTips || [];
    savingsTips.forEach(tip => {
        const li = document.createElement('li');
        li.textContent = tip;
        tipsList.appendChild(li);
    });

    // 3. COOKING TIMELINE RENDER
    renderTodoTimeline(data.cookingTodoList || []);

    // 4. GROCERY LIST RENDER
    renderGroceryList(data.groceryList || []);

    // 5. SUBSTITUTIONS
    const subList = document.getElementById('substitutions-list');
    subList.innerHTML = '';
    
    const substitutions = data.substitutions || [];
    if (substitutions.length > 0) {
        substitutions.forEach(sub => {
            const card = document.createElement('div');
            card.className = 'sub-card';

            const swapRow = document.createElement('div');
            swapRow.className = 'sub-swap-row';

            const originalText = document.createElement('span');
            originalText.className = 'sub-original';
            originalText.textContent = sub.original || '';
            swapRow.appendChild(originalText);

            const arrow = document.createElement('span');
            arrow.className = 'sub-arrow';
            arrow.textContent = '➔';
            swapRow.appendChild(arrow);

            const replacedText = document.createElement('span');
            replacedText.className = 'sub-replace';
            replacedText.textContent = sub.substitutedWith || '';
            swapRow.appendChild(replacedText);

            const reason = document.createElement('div');
            reason.className = 'sub-reason';
            reason.textContent = sub.reason || '';

            card.appendChild(swapRow);
            card.appendChild(reason);
            subList.appendChild(card);
        });
    } else {
        const card = document.createElement('div');
        card.className = 'sub-card';
        const reason = document.createElement('div');
        reason.className = 'sub-reason';
        reason.textContent = 'No substitutions needed. Ingredients are standard pantry staples!';
        card.appendChild(reason);
        subList.appendChild(card);
    }

    // Reveal Dashboard
    dashboardContainer.classList.remove('hidden');
    dashboardContainer.scrollIntoView({ behavior: 'smooth' });
}

// RENDER HELPER FOR MEAL PANEL
function renderMeal(key, meal) {
    if (!meal) return;
    document.getElementById(`${key}-name`).textContent = meal.name || 'N/A';
    document.getElementById(`${key}-prep`).textContent = meal.prepTime || '0m';
    document.getElementById(`${key}-cook`).textContent = meal.cookTime || '0m';
    document.getElementById(`${key}-desc`).textContent = meal.description || '';

    const ingrList = document.getElementById(`${key}-ingredients`);
    ingrList.innerHTML = '';
    const ingredients = meal.ingredients || [];
    ingredients.forEach(ing => {
        const li = document.createElement('li');
        li.textContent = ing;
        ingrList.appendChild(li);
    });

    const instList = document.getElementById(`${key}-instructions`);
    instList.innerHTML = '';
    const instructions = meal.instructions || [];
    instructions.forEach(step => {
        const li = document.createElement('li');
        li.textContent = step;
        instList.appendChild(li);
    });
}

// RENDER TIMELINE TO-DO
function renderTodoTimeline(todoList) {
    const listContainer = document.getElementById('todo-phases-list');
    listContainer.innerHTML = '';

    // Group items by Phase Timeframe
    const phases = {};
    todoList.forEach((todo, idx) => {
        const phase = todo.timeframe || 'General Prep';
        if (!phases[phase]) phases[phase] = [];
        phases[phase].push({ ...todo, index: idx });
    });

    // Populate UI
    const timeframes = ['Morning Prep', 'Mid-day Prep', '30 Mins Before', 'Active Cooking', 'Post-Cooking', 'General Prep'];
    
    timeframes.forEach(timeframe => {
        if (!phases[timeframe] || phases[timeframe].length === 0) return;

        const phaseEl = document.createElement('div');
        phaseEl.className = 'timeline-phase';
        
        // Highlight active phase based on completion
        // If all items in this phase are not checked, set it active-phase
        let hasUnchecked = false;
        phases[timeframe].forEach(item => {
            if (!state.checkedTodos[item.index]) hasUnchecked = true;
        });
        if (hasUnchecked) {
            phaseEl.classList.add('active-phase');
        }

        const titleEl = document.createElement('div');
        titleEl.className = 'timeline-phase-title';
        titleEl.textContent = timeframe;
        phaseEl.appendChild(titleEl);

        phases[timeframe].forEach(item => {
            const isChecked = state.checkedTodos[item.index] || false;
            
            const itemEl = document.createElement('div');
            itemEl.className = `todo-item ${isChecked ? 'checked' : ''}`;
            itemEl.dataset.idx = item.index;

            const checkboxWrapper = document.createElement('div');
            checkboxWrapper.className = 'custom-checkbox-wrapper';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'todo-checkbox';
            checkbox.checked = isChecked;
            checkbox.setAttribute('aria-label', 'Mark task done');
            checkboxWrapper.appendChild(checkbox);

            const stepText = document.createElement('span');
            stepText.className = 'todo-text';
            stepText.textContent = item.step || '';

            const mealTag = document.createElement('span');
            mealTag.className = 'todo-meal-tag';
            mealTag.textContent = item.associatedMeal || 'Prep';

            itemEl.appendChild(checkboxWrapper);
            itemEl.appendChild(stepText);
            itemEl.appendChild(mealTag);

            // Toggle Event
            itemEl.addEventListener('click', (e) => {
                if (e.target.tagName === 'INPUT') return;
                checkbox.checked = !checkbox.checked;
                toggleTodoChecked(item.index, checkbox.checked, itemEl);
            });

            checkbox.addEventListener('change', () => {
                toggleTodoChecked(item.index, checkbox.checked, itemEl);
            });

            phaseEl.appendChild(itemEl);
        });

        listContainer.appendChild(phaseEl);
    });

    updateTodoProgress();
}

function toggleTodoChecked(index, checked, element) {
    if (checked) {
        state.checkedTodos[index] = true;
        element.classList.add('checked');
    } else {
        delete state.checkedTodos[index];
        element.classList.remove('checked');
    }
    
    // Recalculate phases active class (glowing bullet)
    document.querySelectorAll('.timeline-phase').forEach(phaseEl => {
        let hasUnchecked = false;
        phaseEl.querySelectorAll('.todo-item').forEach(itemEl => {
            if (!itemEl.classList.contains('checked')) hasUnchecked = true;
        });
        if (hasUnchecked) {
            phaseEl.classList.add('active-phase');
        } else {
            phaseEl.classList.remove('active-phase');
        }
    });

    saveCachedPlan();
    updateTodoProgress();
}

function updateTodoProgress() {
    const total = state.mealData ? state.mealData.cookingTodoList.length : 0;
    const completed = Object.keys(state.checkedTodos).length;
    
    document.getElementById('todo-count').textContent = `${completed}/${total} Completed`;
    const bar = document.getElementById('todo-progress-fill');
    
    if (total === 0) {
        bar.style.width = '0%';
    } else {
        const percent = (completed / total) * 100;
        bar.style.width = `${percent}%`;
    }
}

// RENDER GROCERY LIST
function renderGroceryList(groceryItems) {
    const container = document.getElementById('grocery-categories');
    container.innerHTML = '';

    // Group items by Category
    const categories = {};
    groceryItems.forEach((item, idx) => {
        const cat = item.category || 'Other';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push({ ...item, index: `api-${idx}`, type: 'api' });
    });

    // Add custom grocery items
    state.customGrocery.forEach((item, idx) => {
        const cat = 'Custom Additions';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push({ ...item, index: `custom-${idx}`, type: 'custom' });
    });

    // Display
    for (const [category, items] of Object.entries(categories)) {
        if (items.length === 0) continue;

        const catEl = document.createElement('div');
        catEl.className = 'grocery-category';

        const titleEl = document.createElement('div');
        titleEl.className = 'grocery-category-title';
        titleEl.textContent = category;
        catEl.appendChild(titleEl);

        items.forEach(item => {
            const isChecked = state.checkedGrocery[item.index] || false;

            const itemEl = document.createElement('div');
            itemEl.className = `grocery-item ${isChecked ? 'checked' : ''}`;
            itemEl.dataset.key = item.index;

            const checkboxWrapper = document.createElement('div');
            checkboxWrapper.className = 'custom-checkbox-wrapper';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'grocery-checkbox';
            checkbox.checked = isChecked;
            checkbox.setAttribute('aria-label', 'Check item');
            checkboxWrapper.appendChild(checkbox);

            const details = document.createElement('div');
            details.className = 'grocery-item-details';

            const nameEl = document.createElement('span');
            nameEl.className = 'grocery-item-name';
            nameEl.textContent = item.name || '';
            details.appendChild(nameEl);

            const qtyEl = document.createElement('span');
            qtyEl.className = 'grocery-qty';
            qtyEl.textContent = item.quantity || '';
            details.appendChild(qtyEl);

            const costEl = document.createElement('span');
            costEl.className = 'grocery-cost';
            costEl.textContent = item.estimatedCost ? `$${item.estimatedCost.toFixed(2)}` : '—';
            details.appendChild(costEl);

            itemEl.appendChild(checkboxWrapper);
            itemEl.appendChild(details);

            if (item.type === 'custom') {
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-grocery-item';
                deleteBtn.type = 'button';
                deleteBtn.title = 'Delete custom item';
                deleteBtn.textContent = '×';
                itemEl.appendChild(deleteBtn);

                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const customIdx = parseInt(item.index.split('-')[1], 10);
                    removeCustomGroceryItem(customIdx);
                });
            }

            itemEl.addEventListener('click', (e) => {
                if (e.target.tagName === 'INPUT' || e.target.closest('.delete-grocery-item')) return;
                checkbox.checked = !checkbox.checked;
                toggleGroceryChecked(item.index, checkbox.checked, itemEl);
            });

            checkbox.addEventListener('change', () => {
                toggleGroceryChecked(item.index, checkbox.checked, itemEl);
            });

            catEl.appendChild(itemEl);
        });

        container.appendChild(catEl);
    }

    updateGroceryStats();
}

function toggleGroceryChecked(key, checked, element) {
    if (checked) {
        state.checkedGrocery[key] = true;
        element.classList.add('checked');
    } else {
        delete state.checkedGrocery[key];
        element.classList.remove('checked');
    }
    
    saveCachedPlan();
    updateGroceryStats();
}

function updateGroceryStats() {
    const apiTotal = state.mealData ? state.mealData.groceryList.length : 0;
    const customTotal = state.customGrocery.length;
    const total = apiTotal + customTotal;

    const completed = Object.keys(state.checkedGrocery).length;
    document.getElementById('grocery-count').textContent = `${completed}/${total} Packed`;
}

// CUSTOM GROCERY LIST HANDLING
function addCustomGroceryItem() {
    const nameInput = document.getElementById('custom-grocery-name');
    const qtyInput = document.getElementById('custom-grocery-qty');

    const name = nameInput.value.trim();
    const qty = qtyInput.value.trim();

    if (!name) return;

    state.customGrocery.push({
        name: name,
        quantity: qty,
        estimatedCost: null,
        category: 'Custom Additions'
    });

    nameInput.value = '';
    qtyInput.value = '';

    saveCachedPlan();
    renderGroceryList(state.mealData.groceryList);
}

function removeCustomGroceryItem(idx) {
    // Remove from array
    state.customGrocery.splice(idx, 1);
    
    // Clean checking state mapping
    const key = `custom-${idx}`;
    delete state.checkedGrocery[key];
    
    // Shift remaining checkboxes alignment
    const newChecked = {};
    for (const [k, v] of Object.entries(state.checkedGrocery)) {
        if (k.startsWith('custom-')) {
            const currentIdx = parseInt(k.split('-')[1]);
            if (currentIdx > idx) {
                newChecked[`custom-${currentIdx - 1}`] = true;
            } else if (currentIdx < idx) {
                newChecked[k] = true;
            }
        } else {
            newChecked[k] = true;
        }
    }
    state.checkedGrocery = newChecked;

    saveCachedPlan();
    renderGroceryList(state.mealData.groceryList);
}

// LOCALSTORAGE CACHE HANDLERS
function saveCachedPlan() {
    if (!state.mealData) return;
    localStorage.setItem('chefflow_cached_plan', JSON.stringify(state.mealData));
    localStorage.setItem('chefflow_checked_todos', JSON.stringify(state.checkedTodos));
    localStorage.setItem('chefflow_checked_grocery', JSON.stringify(state.checkedGrocery));
    localStorage.setItem('chefflow_custom_grocery', JSON.stringify(state.customGrocery));
}

function loadCachedPlan() {
    const cachedPlan = localStorage.getItem('chefflow_cached_plan');
    if (cachedPlan) {
        try {
            state.mealData = JSON.parse(cachedPlan);
            state.checkedTodos = JSON.parse(localStorage.getItem('chefflow_checked_todos') || '{}');
            state.checkedGrocery = JSON.parse(localStorage.getItem('chefflow_checked_grocery') || '{}');
            state.customGrocery = JSON.parse(localStorage.getItem('chefflow_custom_grocery') || '[]');
            
            renderDashboard();
        } catch (e) {
            console.error("Error reading cached meal plan:", e);
            clearCachedPlan();
        }
    }
}

function clearCachedPlan() {
    localStorage.removeItem('chefflow_cached_plan');
    localStorage.removeItem('chefflow_checked_todos');
    localStorage.removeItem('chefflow_checked_grocery');
    localStorage.removeItem('chefflow_custom_grocery');
    
    state.mealData = null;
    state.checkedTodos = {};
    state.checkedGrocery = {};
    state.customGrocery = [];
    
    dashboardContainer.classList.add('hidden');
    plannerForm.reset();
}

// DEMO MOCK DATA FOR IMMEDIATE EVALUATION
function runDemoMode(schedule, diet, budgetLevel, budgetTarget) {
    errorCard.classList.add('hidden');
    dashboardContainer.classList.add('hidden');
    loadingState.classList.remove('hidden');
    generateBtn.disabled = true;

    // Faster progress bar
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += 10;
        if (progress > 100) progress = 100;
        loadingProgressBar.style.width = `${progress}%`;
    }, 200);

    const steps = [
        "Starting ChefFlow Demo Core...",
        "Simulating kitchen constraints...",
        "Evaluating budget matching...",
        "Sourcing virtual mock lists..."
    ];
    let stepIdx = 0;
    loadingMessage.textContent = steps[stepIdx];
    const messageInterval = setInterval(() => {
        stepIdx = (stepIdx + 1) % steps.length;
        loadingMessage.textContent = steps[stepIdx];
    }, 600);

    setTimeout(() => {
        clearInterval(progressInterval);
        clearInterval(messageInterval);
        loadingState.classList.add('hidden');
        generateBtn.disabled = false;

        // Populate Mock Data based on Diet selection
        let mockMeals = getMockDataForDiet(diet, budgetTarget);
        
        state.mealData = mockMeals;
        state.checkedTodos = {};
        state.checkedGrocery = {};
        state.customGrocery = [];

        saveCachedPlan();
        renderDashboard();
        
        alert("Demo Mode Activated!\nWe loaded custom mock data to showcase the application dashboard interfaces, tracking checkboxes, and feasibility models.");
    }, 2000);
}

function getMockDataForDiet(diet, budgetTarget) {
    const totalEst = Math.min(budgetTarget * 0.78, 22.50);
    const status = totalEst <= budgetTarget ? "Within Budget" : "Slightly Over Budget";

    // Standard Mock Data Pack
    return {
        "meals": {
            "breakfast": {
                "name": "Savory Avocado Toast with Soft-Boiled Egg",
                "prepTime": "5 mins",
                "cookTime": "6 mins",
                "description": "Crispy artisanal sourdough bread base topped with freshly mashed seasoned avocado, a pinch of sea salt, red chili flakes, and a perfectly cooked medium soft-boiled egg.",
                "ingredients": ["2 slices Artisan Sourdough bread", "1 ripe Hass Avocado", "2 free-range Eggs", "1 tsp Olive oil", "Pinch of red pepper flakes", "Sea salt and cracked black pepper"],
                "instructions": [
                    "Bring a small pot of water to a boil, slide in the eggs, and cook for exactly 6 minutes. Transfer to ice water immediately.",
                    "Toast the sourdough slices until golden and crisp.",
                    "Mash avocado pulp with olive oil, salt, pepper, and a dash of lemon juice in a small bowl.",
                    "Peel and slice the eggs. Spread mashed avocado evenly onto toast, lay egg slices on top, and garnish with chili flakes."
                ]
            },
            "lunch": {
                "name": "Pan-Seared Chickpea & Lemon-Tahini Salad Wrap",
                "prepTime": "10 mins",
                "cookTime": "5 mins",
                "description": "Warm flatbread filled with seasoned chickpeas, fresh cucumber, diced tomatoes, crisp greens, and a creamy lemon-garlic tahini dressing.",
                "ingredients": ["1 can Chickpeas (rinsed and drained)", "2 large Tortillas or Flatbreads", "1/2 English Cucumber (diced)", "1 medium Roma Tomato (diced)", "2 cups Mixed Salad Greens", "2 tbsp Tahini paste", "1/2 fresh Lemon (juiced)"],
                "instructions": [
                    "Heat a pan with a splash of oil and sauté chickpeas with cumin and salt for 5 minutes until lightly browned.",
                    "In a small cup, whisk tahini, lemon juice, minced garlic, and 1 tablespoon of warm water until smooth.",
                    "Warm the tortillas. Toss chickpeas, cucumber, and tomato together.",
                    "Layer fresh greens onto the wraps, spoon chickpea salad over, drizzle tahini sauce, fold securely, and slice in half."
                ]
            },
            "dinner": {
                "name": "One-Pot Creamy Tomato & Spinach Pasta",
                "prepTime": "10 mins",
                "cookTime": "15 mins",
                "description": "Rich penne pasta simmered directly with sweet marinara, vegetable stock, a touch of cream (or coconut cream), fresh baby spinach, and finished with fresh basil leaves.",
                "ingredients": ["8 oz Penne Pasta", "1.5 cups Marinara sauce", "2 cups Vegetable broth", "1/2 cup heavy cream (or Coconut milk)", "2 cups fresh Baby Spinach", "1 tbsp Olive oil", "2 cloves Garlic (minced)", "Fresh basil leaves"],
                "instructions": [
                    "Heat olive oil in a deep pot and sauté minced garlic for 1 minute until fragrant.",
                    "Add penne pasta, marinara sauce, and vegetable broth. Stir, bring to a boil, cover, and cook on medium-low for 11 minutes (stir occasionally to avoid sticking).",
                    "Remove lid, pour in cream, and fold in fresh baby spinach. Simmer for 2 minutes until spinach is fully wilted.",
                    "Serve hot garnished with torn fresh basil leaves and ground pepper."
                ]
            }
        },
        "groceryList": [
            { "name": "Artisan Sourdough bread", "category": "Bakery", "quantity": "1 loaf", "estimatedCost": 3.50 },
            { "name": "Hass Avocado", "category": "Produce", "quantity": "2 medium", "estimatedCost": 2.20 },
            { "name": "Free-range Eggs", "category": "Dairy", "quantity": "1 carton (6-pack)", "estimatedCost": 2.50 },
            { "name": "Chickpeas (Canned)", "category": "Pantry", "quantity": "1 can", "estimatedCost": 0.90 },
            { "name": "Tortillas/Flatbreads", "category": "Bakery", "quantity": "1 pack", "estimatedCost": 2.00 },
            { "name": "English Cucumber", "category": "Produce", "quantity": "1 medium", "estimatedCost": 1.10 },
            { "name": "Roma Tomato & Mixed Greens", "category": "Produce", "quantity": "1 bag", "estimatedCost": 2.50 },
            { "name": "Tahini paste", "category": "Pantry", "quantity": "1 small jar", "estimatedCost": 3.20 },
            { "name": "Penne Pasta & Marinara", "category": "Pantry", "quantity": "1 box & 1 jar", "estimatedCost": 2.80 },
            { "name": "Baby Spinach & Garlic", "category": "Produce", "quantity": "1 package & bulb", "estimatedCost": 2.30 }
        ],
        "substitutions": [
            { "original": "Tahini paste", "substitutedWith": "Greek Yogurt or Peanut Butter", "reason": "Yogurt provides creaminess for dressing, while diluted peanut butter mirrors nutty undertones." },
            { "original": "Eggs", "substitutedWith": "Crispy Smoked Tofu Cubes", "reason": "Maintains high protein content for breakfast while accommodating vegan diets." }
        ],
        "cookingTodoList": [
            { "timeframe": "Morning Prep", "step": "Hard boil breakfast eggs (6 mins), rinse and drain chickpeas, and store cucumber/tomato in prep bowls.", "associatedMeal": "General" },
            { "timeframe": "Mid-day Prep", "step": "Sauté lunch chickpeas for 5 mins, whip up tahini dressing, assemble and wrap tortillas.", "associatedMeal": "Lunch" },
            { "timeframe": "30 Mins Before", "step": "Boil pasta water pot, chop garlic cloves, wash and stem baby spinach leaves.", "associatedMeal": "Dinner" },
            { "timeframe": "Active Cooking", "step": "Sauté garlic, add dry pasta directly with broth and marinara. Simmer 11 mins, finish with cream and spinach.", "associatedMeal": "Dinner" }
        ],
        "budgetFeasibility": {
            "totalEstimatedCost": totalEst,
            "status": status,
            "analysis": `The daily estimated food cost is $${totalEst.toFixed(2)}, which is within your target limit of $${budgetTarget.toFixed(2)}. The ingredients rely heavily on seasonal produce and staple pantry grains to maximize value.`,
            "savingsTips": [
                "Tip: Choose store-brand dry penne and canned chickpeas to reduce the grocery bill by another $1.10.",
                "Tip: Extra spinach can be frozen or blended into breakfast smoothies tomorrow."
            ]
        }
    };
}

/* ==========================================================================
   DECRYPTION UTILITIES (WEB CRYPTO API)
   ========================================================================== */

/**
 * Converts a Base64 string to an ArrayBuffer.
 */
function base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Decrypts a ciphertext using a passcode.
 * Uses PBKDF2 for key derivation and AES-GCM for decryption.
 */
async function decryptPayload(encryptedObj, passcode) {
    const salt = base64ToArrayBuffer(encryptedObj.salt);
    const iv = base64ToArrayBuffer(encryptedObj.iv);
    const ciphertext = base64ToArrayBuffer(encryptedObj.ciphertext);
    
    const enc = new TextEncoder();
    const dec = new TextDecoder();
    
    // Import raw passcode key
    const rawKey = await window.crypto.subtle.importKey(
        "raw",
        enc.encode(passcode),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );
    
    // Derive the 256-bit AES-GCM key
    const aesKey = await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        rawKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
    );
    
    // Perform AES-GCM decryption
    const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        aesKey,
        ciphertext
    );
    
    return dec.decode(decryptedBuffer);
}

/* ==========================================================================
   RADAR CHART RENDERER
   ========================================================================== */

/**
 * Generates and inserts a custom SVG Radar Chart based on skills data.
 */
function renderRadarChart(skills) {
    const container = document.getElementById('radar-chart-container');
    if (!container) return;

    const width = 380;
    const height = 380;
    const center = { x: width / 2, y: height / 2 };
    const radius = 120;
    const levels = 5;
    const totalAxes = skills.length;

    // Angle of each vertex (starting straight up)
    const angles = Array.from({ length: totalAxes }, (_, i) => (2 * Math.PI * i / totalAxes) - (Math.PI / 2));

    let svgContent = `<svg viewBox="0 0 ${width} ${height}" width="100%" height="100%">
        <defs>
            <linearGradient id="radar-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="var(--accent-purple)" />
                <stop offset="100%" stop-color="var(--accent-blue)" />
            </linearGradient>
            <filter id="radar-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
        </defs>`;

    // 1. Draw grid rings (polygons)
    for (let level = levels; level > 0; level--) {
        const factor = level / levels;
        const points = angles.map(angle => {
            const x = center.x + Math.cos(angle) * radius * factor;
            const y = center.y + Math.sin(angle) * radius * factor;
            return `${x},${y}`;
        }).join(' ');

        svgContent += `<polygon class="radar-grid" points="${points}" />`;
    }

    // 2. Draw axis lines
    angles.forEach(angle => {
        const x = center.x + Math.cos(angle) * radius;
        const y = center.y + Math.sin(angle) * radius;
        svgContent += `<line class="radar-axis" x1="${center.x}" y1="${center.y}" x2="${x}" y2="${y}" />`;
    });

    // 3. Draw data polygon
    const dataPoints = skills.map((skill, index) => {
        const factor = skill.value / 100;
        const x = center.x + Math.cos(angles[index]) * radius * factor;
        const y = center.y + Math.sin(angles[index]) * radius * factor;
        return `${x},${y}`;
    }).join(' ');

    svgContent += `<polygon class="radar-polygon" points="${dataPoints}" filter="url(#radar-glow)" />`;

    // 4. Draw data markers (dots) and text labels
    skills.forEach((skill, index) => {
        const angle = angles[index];
        const factor = skill.value / 100;
        
        // Marker
        const x = center.x + Math.cos(angle) * radius * factor;
        const y = center.y + Math.sin(angle) * radius * factor;
        svgContent += `<circle class="radar-dot" cx="${x}" cy="${y}" r="4" />`;

        // Label alignment parameters
        const labelDistance = radius + 22;
        const lx = center.x + Math.cos(angle) * labelDistance;
        const ly = center.y + Math.sin(angle) * labelDistance;

        let textAnchor = 'middle';
        const cosAngle = Math.cos(angle);
        if (cosAngle > 0.1) {
            textAnchor = 'start';
        } else if (cosAngle < -0.1) {
            textAnchor = 'end';
        }

        // Vertically center alignment
        const dy = Math.abs(cosAngle) < 0.1 ? '0.35em' : (Math.sin(angle) > 0 ? '0.7em' : '-0.2em');

        svgContent += `<text class="radar-label" x="${lx}" y="${ly}" text-anchor="${textAnchor}" dy="${dy}">${skill.label}</text>`;
    });

    svgContent += `</svg>`;
    container.innerHTML = svgContent;
}

/* ==========================================================================
   DYNAMIC DOM RENDERING
   ========================================================================== */

/**
 * Renders decrypted data elements directly into the HTML structure.
 */
function renderProfile(data) {
    // 1. Text elements
    document.getElementById('profile-name').textContent = data.name;
    document.getElementById('profile-title').textContent = data.title;
    document.getElementById('profile-location').textContent = data.location;
    document.getElementById('profile-bio').textContent = data.bio;
    
    // Footer and contact
    document.getElementById('footer-year').textContent = new Date().getFullYear();
    
    const emailEl = document.getElementById('contact-email');
    emailEl.textContent = data.contact.email;
    
    document.getElementById('contact-email-card').href = `mailto:${data.contact.email}`;
    document.getElementById('contact-linkedin').href = data.contact.linkedin;
    document.getElementById('contact-github').href = data.contact.github;

    // 2. Timeline
    const timelineContainer = document.getElementById('timeline-container');
    timelineContainer.innerHTML = '';
    
    data.journey.forEach(item => {
        const node = document.createElement('div');
        node.className = 'timeline-node reveal-up';
        node.innerHTML = `
            <div class="timeline-badge"></div>
            <div class="timeline-card glass">
                <span class="timeline-year">${item.year}</span>
                <h3 class="timeline-title">${item.title}</h3>
                <div class="timeline-loc">
                    <i data-lucide="map-pin" class="timeline-loc-icon"></i>
                    <span>${item.location}</span>
                </div>
                <p class="timeline-desc">${item.description}</p>
            </div>
        `;
        timelineContainer.appendChild(node);
    });

    // 3. Skill categories
    const skillsContainer = document.getElementById('skills-categories-container');
    skillsContainer.innerHTML = '';
    
    const iconMapping = {
        "Data Science & ML": "brain-circuit",
        "Data & Cloud Infrastructure": "database",
        "Leadership & Strategy": "users"
    };

    data.skills.forEach(cat => {
        const icon = iconMapping[cat.category] || "check-circle";
        const card = document.createElement('div');
        card.className = 'skills-card glass';
        card.innerHTML = `
            <h4><i data-lucide="${icon}"></i>${cat.category}</h4>
            <div class="skills-list">
                ${cat.items.map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
            </div>
        `;
        skillsContainer.appendChild(card);
    });

    // 4. Highlights
    const highlightsContainer = document.getElementById('highlights-container');
    highlightsContainer.innerHTML = '';
    
    const highlightIcons = ["line-chart", "cpu", "git-fork", "award"];
    
    data.highlights.forEach((item, index) => {
        const icon = highlightIcons[index % highlightIcons.length];
        const card = document.createElement('div');
        card.className = 'highlight-card glass reveal-up';
        card.innerHTML = `
            <div class="highlight-icon-box">
                <i data-lucide="${icon}"></i>
            </div>
            <h3>${item.title}</h3>
            <p>${item.description}</p>
        `;
        highlightsContainer.appendChild(card);
    });

    // 5. Build Radar Chart
    renderRadarChart(data.radarSkills);

    // 6. Initialize Lucide Icons for dynamic content
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

/* ==========================================================================
   SCROLL EFFECT LISTENERS (REVEALS AND NAV HIGHLIGHTING)
   ========================================================================== */

function initScrollEffects() {
    // 1. Intersection Observer for elements fading up on entry
    const revealElements = document.querySelectorAll('.reveal-up');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target); // Trigger once
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    revealElements.forEach(el => observer.observe(el));

    // 2. Navigation Highlighting on scroll
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('.nav-link');

    window.addEventListener('scroll', () => {
        let currentSection = '';
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (pageYOffset >= (sectionTop - varHeaderOffset())) {
                currentSection = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${currentSection}`) {
                link.classList.add('active');
            }
        });
    });

    function varHeaderOffset() {
        return window.innerWidth <= 768 ? 100 : 150;
    }
}

/* ==========================================================================
   FORM & ACTION EVENT HANDLERS
   ========================================================================== */

function initEventHandlers() {
    // Simplified contact channel cards require no submit overrides.
}

/* ==========================================================================
   INITIALIZATION AND DECRYPTION FORM
   ========================================================================== */

/* ==========================================================================
   THEME TOGGLE SYSTEM (DARK / LIGHT MODE)
   ========================================================================== */

function updateThemeIcons(theme) {
    const themeIcons = document.querySelectorAll('#theme-icon, #lock-theme-icon');
    themeIcons.forEach(icon => {
        if (theme === 'dark') {
            icon.setAttribute('data-lucide', 'sun');
        } else {
            icon.setAttribute('data-lucide', 'moon');
        }
    });
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcons(newTheme);
}

function initThemeToggle() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    updateThemeIcons(currentTheme);
    
    const buttons = document.querySelectorAll('#theme-toggle, #lock-theme-toggle');
    buttons.forEach(btn => {
        btn.addEventListener('click', toggleTheme);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Theme Toggle
    initThemeToggle();

    // Start Lucide for the static lock card
    if (window.lucide) {
        window.lucide.createIcons();
    }

    const lockScreen = document.getElementById('lock-screen');
    const lockForm = document.getElementById('lock-form');
    const passcodeInput = document.getElementById('passcode-input');
    const errorMessage = document.getElementById('error-message');
    const unlockBtn = document.getElementById('unlock-btn');
    const mainContent = document.getElementById('main-content');
    const lockCard = document.querySelector('.lock-card');

    if (lockForm) {
        lockForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const enteredCode = passcodeInput.value.trim();
            if (!enteredCode) return;
            
            // Show loading state on button
            const originalBtnContent = unlockBtn.innerHTML;
            unlockBtn.disabled = true;
            unlockBtn.innerHTML = '<span class="loading-spinner"></span>';
            errorMessage.style.display = 'none';

            try {
                // Decrypt the profile using global ENCRYPTED_PROFILE from encrypted_data.js
                if (typeof ENCRYPTED_PROFILE === 'undefined') {
                    throw new Error('Encrypted payload missing.');
                }

                const decryptedText = await decryptPayload(ENCRYPTED_PROFILE, enteredCode);
                const data = JSON.parse(decryptedText);

                // Render dynamic details
                renderProfile(data);

                // Add success fade out transition
                lockScreen.classList.add('fade-out');
                mainContent.style.display = 'block';
                
                // Allow elements to render in DOM before initiating animations
                setTimeout(() => {
                    initScrollEffects();
                    initEventHandlers();
                    // Manually trigger the hero reveals
                    document.querySelectorAll('#about .reveal-up').forEach(el => {
                        el.classList.add('active');
                    });
                }, 100);

            } catch (err) {
                console.error('Decryption failed:', err);
                
                // Trigger shake visual error
                lockCard.classList.add('shake');
                errorMessage.style.display = 'flex';
                passcodeInput.value = '';
                passcodeInput.focus();
                
                // Remove shake after animation completes to allow subsequent shaking
                setTimeout(() => {
                    lockCard.classList.remove('shake');
                }, 400);
            } finally {
                // Restore button state
                unlockBtn.disabled = false;
                unlockBtn.innerHTML = originalBtnContent;
            }
        });
    }
});

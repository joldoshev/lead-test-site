// Countdown Timer
function startCountdown() {
    const countdownElement = document.querySelector('.countdown');
    if (!countdownElement) return;

    // Set the date we're counting down to (e.g., 9 hours from now)
    const countDownDate = new Date().getTime() + (9 * 60 * 60 * 1000);

    const daysEl = document.getElementById('days');
    const hoursEl = document.getElementById('hours');
    const minutesEl = document.getElementById('minutes');
    const secondsEl = document.getElementById('seconds');

    // Ensure elements exist before proceeding
    if (!daysEl || !hoursEl || !minutesEl || !secondsEl) return;

    const updateCountdown = () => {
        const now = new Date().getTime();
        const distance = countDownDate - now;

        if (distance < 0) {
            clearInterval(interval);
            daysEl.innerHTML = "0";
            hoursEl.innerHTML = "0";
            minutesEl.innerHTML = "0";
            secondsEl.innerHTML = "0";
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        // Add leading zero if number is less than 10
        daysEl.innerHTML = days < 10 ? '0' + days : days;
        hoursEl.innerHTML = hours < 10 ? '0' + hours : hours;
        minutesEl.innerHTML = minutes < 10 ? '0' + minutes : minutes;
        secondsEl.innerHTML = seconds < 10 ? '0' + seconds : seconds;
    };

    const interval = setInterval(updateCountdown, 1000);
    updateCountdown(); // Initial call to avoid 1-second delay
}

document.addEventListener('DOMContentLoaded', () => {
    startCountdown();

    // Modal Logic
    const openModalButtons = document.querySelectorAll('.open-modal-button');
    const closeModalButton = document.getElementById('modal-close-btn');
    const modalOverlay = document.getElementById('form-modal-overlay');
    const modal = document.getElementById('form-modal');

    if (modal) {
        openModalButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                modal.classList.add('active');
                modalOverlay.classList.add('active');
            });
        });

        const closeModal = () => {
            modal.classList.remove('active');
            modalOverlay.classList.remove('active');
        };

        closeModalButton.addEventListener('click', closeModal);
        modalOverlay.addEventListener('click', closeModal);
    }

    // intl-tel-input initialization
    const phoneInput = document.querySelector("#phone");
    if (phoneInput) {
        window.intlTelInput(phoneInput, {
            initialCountry: "auto",
            geoIpLookup: callback => {
                fetch("https://ipapi.co/json")
                    .then(res => res.json())
                    .then(data => callback(data.country_code))
                    .catch(() => callback("us"));
            },
            utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js",
        });
    }

    // Bitrix24 Form Submission
    const bitrixForm = document.getElementById('bitrix-form');
    if (bitrixForm) {
        bitrixForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const bitrixWebhookBaseURL = 'https://nextgeneration.bitrix24.kz/rest/55843/8z96i1qpctkkn0yz/';
            const dealCategoryID = 31;

            const form = e.target;
            const formData = new FormData(form);
            const data = {};
            formData.forEach((value, key) => { data[key] = value; });

            const submitButton = form.querySelector('.submit-button');
            const formMessage = document.getElementById('form-message');

            // Reset form state
            submitButton.textContent = 'Отправка...';
            submitButton.disabled = true;
            formMessage.style.display = 'none';
            formMessage.className = '';

            console.log('--- Bitrix24 Submission Started ---');
            console.log('Deal Category ID:', dealCategoryID);
            console.log('Form Data:', data);

            try {
                // Step 1: Automatically find the initial stage for the specified funnel
                console.log('Step 1: Fetching stages for the funnel...');
                const stageResponse = await fetch(bitrixWebhookBaseURL + 'crm.dealcategory.stage.list.json', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: dealCategoryID })
                });
                console.log('Step 1 Response Status:', stageResponse.status);
                const stageResult = await stageResponse.json();
                console.log('Step 1 Response Body (Stages):', stageResult);
                if (!stageResult.result || stageResult.result.length === 0) {
                    throw new Error(`Could not find any stages for deal category ${dealCategoryID}. Check permissions or category ID.`);
                }
                const initialStageId = stageResult.result[0].STATUS_ID;
                console.log('Step 1 Success: Found initial stage ID:', initialStageId);

                // Step 2: Create or find the contact
                console.log('Step 2: Creating or finding contact...');
                let contactId;
                const contactData = { fields: { NAME: data.NAME, PHONE: [{ VALUE: data.PHONE, VALUE_TYPE: 'WORK' }], OPENED: 'Y' } };
                const addContactResponse = await fetch(bitrixWebhookBaseURL + 'crm.contact.add.json', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(contactData)
                });
                console.log('Step 2.1 (Add Contact) Response Status:', addContactResponse.status);
                const contactRes = await addContactResponse.json();
                console.log('Step 2.1 (Add Contact) Response Body:', contactRes);

                if (contactRes.result) {
                    contactId = contactRes.result;
                } else if (contactRes.error === 'DUPLICATE_COMMUNICATION') {
                    console.log('Step 2.2: Duplicate contact found. Searching for existing contact...');
                    const findContactResponse = await fetch(bitrixWebhookBaseURL + 'crm.contact.list.json', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ filter: { PHONE: data.PHONE } })
                    });
                    console.log('Step 2.2 (Find Contact) Response Status:', findContactResponse.status);
                    const list = await findContactResponse.json();
                    console.log('Step 2.2 (Find Contact) Response Body:', list);
                    if (list.result && list.result.length > 0) {
                        contactId = list.result[0].ID;
                        console.log('Step 2.2 Success: Found existing contact ID:', contactId);
                    } else {
                        throw new Error('Duplicate contact exists but could not be found by phone number.');
                    }
                } else {
                    throw new Error(contactRes.error_description || 'Unknown error creating contact.');
                }

                // Step 3: Create the deal
                console.log(`Step 3: Creating deal with Contact ID: ${contactId} and Stage ID: ${initialStageId}`);
                const dealData = {
                    fields: {
                        TITLE: 'Заявка с сайта',
                        CATEGORY_ID: dealCategoryID,
                        STAGE_ID: initialStageId,
                        CONTACT_ID: contactId,
                        COMMENTS: `Проект: ${data.PROJECT}\nРоль: ${data.ROLE}\nКласс: ${data.GRADE}\nРегион: ${data.REGION}`,
                        SOURCE_ID: 'WEB'
                    }
                };
                console.log('Step 3 Deal Payload:', dealData);
                const dealResponse = await fetch(bitrixWebhookBaseURL + 'crm.deal.add.json', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dealData)
                });
                console.log('Step 3 (Create Deal) Response Status:', dealResponse.status);
                const dealResult = await dealResponse.json();
                console.log('Step 3 (Create Deal) Response Body:', dealResult);

                if (!dealResult.result) {
                    throw new Error(dealResult.error_description || 'Unknown error creating deal.');
                }

                console.log('--- Bitrix24 Submission Succeeded ---');
                formMessage.textContent = 'Успешно отправлено! Мы скоро с вами свяжемся.';
                formMessage.className = 'success';
                formMessage.style.display = 'block';
                submitButton.textContent = 'Успешно!';

                setTimeout(() => {
                    modal.classList.remove('active');
                    modalOverlay.classList.remove('active');
                    form.reset();
                    submitButton.textContent = 'Получить консультацию';
                    submitButton.disabled = false;
                    formMessage.style.display = 'none';
                }, 3000);

            } catch (error) {
                console.error('--- Bitrix24 Submission Failed ---', error);
                formMessage.textContent = 'Произошла ошибка. Пожалуйста, попробуйте еще раз.';
                formMessage.className = 'error';
                formMessage.style.display = 'block';
                submitButton.textContent = 'Ошибка. Попробуйте снова.';
                submitButton.disabled = false;
            }
        });
    }

    // --- YouTube Shorts Carousel ---
    (function initShortsCarousel() {
    // Replace with your real Shorts video IDs
    const SHORTS_IDS = [
        't-FFtUXcpgg', // first
        'QGMNz82upfw', // second (updated)
        'rGarTpdB7hQ'  // third (updated)
    ];

    const prevBtn = document.getElementById('shorts-prev');
    const nextBtn = document.getElementById('shorts-next');
    const frame1 = document.getElementById('shorts-iframe-1');
    const frame2 = document.getElementById('shorts-iframe-2');
    const frame3 = document.getElementById('shorts-iframe-3');

    if (!prevBtn || !nextBtn || !frame1 || !frame2 || !frame3) return;

    let index = 0; // index of the first visible item

    // Build embed URL: use standard /embed/ for all (works for Shorts and normal videos)
    const embedUrl = (id) => `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;

    function render() {
        const a = SHORTS_IDS[(index + 0) % SHORTS_IDS.length];
        const b = SHORTS_IDS[(index + 1) % SHORTS_IDS.length];
        const c = SHORTS_IDS[(index + 2) % SHORTS_IDS.length];
        frame1.src = embedUrl(a);
        frame2.src = embedUrl(b);
        frame3.src = embedUrl(c);
    }

    function prev() {
        index = (index - 1 + SHORTS_IDS.length) % SHORTS_IDS.length;
        render();
    }

    function next() {
        index = (index + 1) % SHORTS_IDS.length;
        render();
    }
    prevBtn.addEventListener('click', prev);
    nextBtn.addEventListener('click', next);
    render();
})();

    // --- Team Images Carousel (Guide Section) ---
    (function initTeamCarousel() {
        const order = [
            'Team/2.png',
            'Team/3.png',
            'Team/4 (1).png',
            'Team/5 (1).png',
            'Team/6.png',
            'Team/7.png',
            'Team/8.png',
            'Team/9.png',
            'Team/10 (1).png',
            'Team/12 (1).png',
            'Team/13.png'
        ];

        const imgEl = document.getElementById('team-carousel-image');
        const prevBtn = document.getElementById('team-prev');
        const nextBtn = document.getElementById('team-next');
        if (!imgEl || !prevBtn || !nextBtn) return;

        let idx = 0;
        const show = (i) => { imgEl.src = order[i]; };
        const prev = () => { idx = (idx - 1 + order.length) % order.length; show(idx); };
        const next = () => { idx = (idx + 1) % order.length; show(idx); };

        prevBtn.addEventListener('click', prev);
        nextBtn.addEventListener('click', next);
        show(idx);
    })();

    // --- Team manual scroll arrows wiring ---
    (function initTeamScrollArrows() {
        const scroller = document.querySelector('.team-scroll');
        const prev = document.getElementById('team-scroll-prev');
        const next = document.getElementById('team-scroll-next');
        if (!scroller || !prev || !next) return;

        const getStep = () => {
            const firstCard = scroller.querySelector('.team-image');
            const style = window.getComputedStyle(scroller);
            const gapPx = parseFloat(style.gap || style.columnGap || '16');
            const cardW = firstCard ? firstCard.getBoundingClientRect().width : 280;
            return Math.max(100, Math.round(cardW + gapPx));
        };

        prev.addEventListener('click', () => {
            scroller.scrollBy({ left: -getStep(), behavior: 'smooth' });
        });
        next.addEventListener('click', () => {
            scroller.scrollBy({ left: getStep(), behavior: 'smooth' });
        });
    })();
});

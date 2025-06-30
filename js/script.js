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
        bitrixForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const bitrixWebhookBaseURL = 'https://nextgeneration.bitrix24.kz/rest/55843/8z96i1qpctkkn0yz/';
            const dealCategoryID = 31;

            const form = e.target;
            const formData = new FormData(form);
            const data = {};
            formData.forEach((value, key) => { data[key] = value; });

            const submitButton = form.querySelector('.submit-button');
            submitButton.textContent = 'Отправка...';
            submitButton.disabled = true;

            console.log('--- Bitrix24 Submission Started ---');
            console.log('Deal Category ID:', dealCategoryID);
            console.log('Form Data:', data);

            // Step 1: Automatically find the initial stage for the specified funnel
            console.log('Step 1: Fetching stages for the funnel...');
            fetch(bitrixWebhookBaseURL + 'crm.dealcategory.stage.list.json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: dealCategoryID })
            })
            .then(response => {
                console.log('Step 1 Response Status:', response.status);
                return response.json();
            })
            .then(stageResult => {
                console.log('Step 1 Response Body (Stages):', stageResult);
                if (!stageResult.result || stageResult.result.length === 0) {
                    throw new Error(`Could not find any stages for deal category ${dealCategoryID}. Check permissions or category ID.`);
                }
                const initialStageId = stageResult.result[0].STATUS_ID;
                console.log('Step 1 Success: Found initial stage ID:', initialStageId);

                // Step 2: Create or find the contact
                console.log('Step 2: Creating or finding contact...');
                const contactData = { fields: { NAME: data.NAME, PHONE: [{ VALUE: data.PHONE, VALUE_TYPE: 'WORK' }], OPENED: 'Y' } };
                return fetch(bitrixWebhookBaseURL + 'crm.contact.add.json', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(contactData)
                })
                .then(res => {
                    console.log('Step 2.1 (Add Contact) Response Status:', res.status);
                    return res.json();
                })
                .then(contactRes => {
                    console.log('Step 2.1 (Add Contact) Response Body:', contactRes);
                    if (contactRes.result) return { contactId: contactRes.result, initialStageId };
                    if (contactRes.error === 'DUPLICATE_COMMUNICATION') {
                        console.log('Step 2.2: Duplicate contact found. Searching for existing contact...');
                        return fetch(bitrixWebhookBaseURL + 'crm.contact.list.json', { 
                            method: 'POST', 
                            headers: { 'Content-Type': 'application/json' }, 
                            body: JSON.stringify({ filter: { PHONE: data.PHONE } })
                        })
                        .then(res => {
                            console.log('Step 2.2 (Find Contact) Response Status:', res.status);
                            return res.json();
                        })
                        .then(list => {
                            console.log('Step 2.2 (Find Contact) Response Body:', list);
                            if (list.result && list.result.length > 0) {
                                const existingContactId = list.result[0].ID;
                                console.log('Step 2.2 Success: Found existing contact ID:', existingContactId);
                                return { contactId: existingContactId, initialStageId };
                            }
                            throw new Error('Duplicate contact exists but could not be found by phone number.');
                        });
                    }
                    throw new Error(contactRes.error_description || 'Unknown error creating contact.');
                });
            })
            .then(({ contactId, initialStageId }) => {
                // Step 3: Create the deal
                console.log(`Step 3: Creating deal with Contact ID: ${contactId} and Stage ID: ${initialStageId}`);
                const dealData = {
                    fields: {
                        TITLE: 'заявка с сайта NL',
                        CATEGORY_ID: dealCategoryID,
                        STAGE_ID: initialStageId,
                        CONTACT_ID: contactId,
                        COMMENTS: `Проект: ${data.PROJECT}\nРоль: ${data.ROLE}\nКласс: ${data.GRADE}`,
                        SOURCE_ID: 'WEB'
                    }
                };
                console.log('Step 3 Deal Payload:', dealData);
                return fetch(bitrixWebhookBaseURL + 'crm.deal.add.json', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dealData)
                });
            })
            .then(response => {
                console.log('Step 3 (Create Deal) Response Status:', response.status);
                return response.json();
            })
            .then(dealResult => {
                console.log('Step 3 (Create Deal) Response Body:', dealResult);
                if (!dealResult.result) throw new Error(dealResult.error_description || 'Unknown error creating deal.');
                
                console.log('--- Bitrix24 Submission Succeeded ---');
                submitButton.textContent = 'Успешно отправлено!';
                setTimeout(() => {
                    modal.classList.remove('active');
                    modalOverlay.classList.remove('active');
                    form.reset();
                    submitButton.textContent = 'Получить консультацию';
                    submitButton.disabled = false;
                }, 2000);
            })
            .catch(error => {
                console.error('--- Bitrix24 Submission Failed ---', error);
                submitButton.textContent = 'Ошибка. Попробуйте снова.';
                submitButton.disabled = false;
            });
        });
    }
});

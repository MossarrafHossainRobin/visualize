document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const dataInput = document.getElementById('dataInput');
    const inputTypeRadios = document.querySelectorAll('input[name="inputType"]');
    const techniqueSelect = document.getElementById('technique');
    const transmissionTypeRadios = document.querySelectorAll('input[name="transmissionType"]');
    const startBtn = document.getElementById('startAnimationBtn');
    const controlsSection = document.getElementById('controlsSection');
    const speedControl = document.getElementById('speedControl');
    const speedValue = document.getElementById('speedValue');
    const pauseResumeBtn = document.getElementById('pauseResumeBtn');
    const resetBtn = document.getElementById('resetBtn');
    const injectErrorBtn = document.getElementById('injectErrorBtn'); // New Button
    const inputError = document.getElementById('inputError');
    const visualizationSection = document.getElementById('visualizationSection');
    const statusDisplay = document.getElementById('statusDisplay');
    const originalInputEl = document.getElementById('originalInput');
    const binaryInputAnimatedEl = document.getElementById('binaryInputAnimated');
    const stuffingTypeEl = document.getElementById('stuffingType');
    const stuffedDataEl = document.getElementById('stuffedData');
    const stuffedBitCountEl = document.getElementById('stuffedBitCount'); // New element
    const encodingBitEl = document.getElementById('encodingBit');
    const encoderBox = document.getElementById('encoderBox');
    const encodingTypeShortEl = document.getElementById('encodingTypeShort'); // For encoder box
    const currentSignalLevelEl = document.getElementById('currentSignalLevel'); // New element
    const encoderStateEl = document.getElementById('encoderState'); // New element
    const transmissionMediumLabel = document.getElementById('transmissionMediumLabel');
    const encodingTypeEl = document.getElementById('encodingType'); // For canvas title
    const signalCanvas = document.getElementById('signalCanvas');
    const decoderBox = document.getElementById('decoderBox');
    const decodedBitEl = document.getElementById('decodedBit');
    const decodedBinaryAnimatedEl = document.getElementById('decodedBinaryAnimated');
    const destuffingTypeLabel = document.getElementById('destuffingTypeLabel');
    const destuffedDataEl = document.getElementById('destuffedData');
    const destuffedBitCountEl = document.getElementById('destuffedBitCount'); // New element
    const finalMessageEl = document.getElementById('finalMessage');
    const bitDropArea = document.getElementById('bitDropArea'); // For animation
    const ctx = signalCanvas.getContext('2d');

    // --- State Variables ---
    let animationIntervalId = null;
    let animationSpeed = 500;
    let isPaused = false;
    let currentStep = 0;
    let totalSteps = 0;
    let originalMessage = '';
    let binaryData = '';
    let stuffedData = '';
    let stuffedIndices = []; // Track indices where stuffing occurred
    let processedData = '';
    let technique = '';
    let encodingName = '';
    let transmissionType = 'wired';
    let signalDataPoints = [];
    let decodedBits = [];
    let bitErrors = []; // Track indices of injected errors
    let destuffedBits = '';
    let finalMessage = '';
    let needsStuffing = false;
    let isBitStuffing = false;
    let requiresNRZLVisualization = false;
    let encodingFn, decodingFn, stuffingFn, destuffingFn;
    let previousLevelNRZI = -1;
    let levelBeforeIntervalDiffMan = -1;
    let injectErrorNext = false; // Flag for error injection

    const FLAG = '01111110';
    const ESC = '01111101';

    // --- Event Listeners ---
    startBtn.addEventListener('click', startAnimation);
    resetBtn.addEventListener('click', resetAnimation);
    pauseResumeBtn.addEventListener('click', togglePauseResume);
    injectErrorBtn.addEventListener('click', () => {
        if (animationIntervalId && !isPaused) { // Only if animation is running
            injectErrorNext = true;
            setStatus('<i class="bi bi-exclamation-diamond-fill me-1"></i>Error injection armed for next bit!', 'warning');
             injectErrorBtn.classList.add('active'); // Visual feedback
        }
    });
    speedControl.addEventListener('input', updateSpeed);

    updateSpeedValue(speedControl.value);
    resetAnimation(); // Initialize UI state correctly

    // --- Core Animation Functions ---

    function startAnimation() {
        resetAnimation();
        isPaused = false;
        updatePauseResumeButton();

        setStatus('<i class="bi bi-hourglass-split me-1"></i>Validating input...', 'info');
        if (!getInputData()) {
            startBtn.disabled = false; // Re-enable start if input fails
            return;
        }

        technique = techniqueSelect.value;
        transmissionType = document.querySelector('input[name="transmissionType"]:checked').value;

        setStatus('<i class="bi bi-gear me-1"></i>Preparing data and applying stuffing...', 'info');
        prepareData();

        if (!processedData) {
            setStatus('<i class="bi bi-x-octagon-fill me-1"></i>Error: Could not process data for encoding.', 'error');
            startBtn.disabled = false;
             return;
        }

        setupVisualizationUI();

        totalSteps = processedData.length;
        currentStep = 0;
        signalDataPoints = [];
        decodedBits = [];
        bitErrors = [];
        injectErrorNext = false;
        previousLevelNRZI = -1;
        levelBeforeIntervalDiffMan = -1;

        if (totalSteps === 0) {
             setStatus('<i class="bi bi-info-circle-fill me-1"></i>No data bits to process after stuffing.', 'warning');
             completeAnimation(); // Go directly to completion if no data
             return;
        }

        setStatus(`<i class="bi bi-play-circle-fill me-1"></i>Starting: Encoding bit 1 of ${totalSteps}...`, 'active');
        visualizationSection.classList.remove('d-none');
        controlsSection.classList.remove('d-none');
        startBtn.disabled = true;
        resetBtn.disabled = false;
        pauseResumeBtn.disabled = false;
        injectErrorBtn.disabled = false;


        animationIntervalId = setInterval(animationStep, animationSpeed);
    }

    async function animationStep() { // Make async for potential delays/animations
        if (isPaused || currentStep >= totalSteps) {
            if (currentStep >= totalSteps) {
                completeAnimation();
            }
            return;
        }

        const bitIndex = currentStep;
        const currentBit = processedData[bitIndex];

        // Find corresponding original binary bit index (approximate for now)
        // TODO: Improve mapping for stuffing accuracy
        const originalBitIndex = findOriginalBitIndex(bitIndex);

        // --- Phase 0: Animate Bit Drop ---
        setStatus(`<i class="bi bi-arrow-down-circle me-1"></i>Processing bit ${bitIndex + 1} ('${currentBit}')...`, "active");
        if (originalBitIndex !== -1) {
             await animateBitDrop(originalBitIndex, currentBit); // Animate the original bit
        }

        // Highlight source bit(s)
        highlightBinarySpan(binaryInputAnimatedEl, originalBitIndex, 'highlight-current');
        if (needsStuffing) {
            highlightBinarySpan(stuffedDataEl, bitIndex, stuffedIndices.includes(bitIndex) ? 'highlight-stuffed' : 'highlight-current', true);
        }
        encodingBitEl.textContent = currentBit;
        encoderBox.classList.add('active');
        highlightStageCard(encoderBox);

        // --- Phase 1: Encoding ---
        const newSignalPoints = calculateEncodingForBit(currentBit, bitIndex);
        const currentLevelText = getCurrentLevelText(newSignalPoints);
        currentSignalLevelEl.textContent = currentLevelText;
        updateEncoderDecoderState('encoder', technique, previousLevelNRZI, levelBeforeIntervalDiffMan); // Update state display

        // Delay slightly after encoding logic shown, before drawing
        await delay(animationSpeed * 0.1);

        signalDataPoints.push(...newSignalPoints);

        // --- Phase 2: Transmission Visualization ---
        encoderBox.classList.remove('active');
        unhighlightStageCard(encoderBox);
        highlightStageCard(signalCanvas); // Highlight transmission card
        setStatus(`<i class="bi bi-reception-4 me-1"></i>Transmitting signal for bit ${bitIndex + 1}...`, "active");

        drawSignal(processedData, signalDataPoints, technique, bitIndex + 1, bitErrors);

        // --- Phase 3: Potential Error Injection ---
        let actualDecodedBit;
        let bitHadError = false;
        if (injectErrorNext) {
            bitHadError = true;
            bitErrors.push(bitIndex); // Record error index
            actualDecodedBit = currentBit === '0' ? '1' : '0'; // Flip the bit
            setStatus(`<i class="bi bi-radioactive me-1"></i>Bit ${bitIndex + 1} flipped during transmission!`, 'error');
            injectErrorNext = false; // Reset flag
            injectErrorBtn.classList.remove('active'); // Deactivate button visual
            // Redraw signal immediately to show error marker
            drawSignal(processedData, signalDataPoints, technique, bitIndex + 1, bitErrors);
            await delay(animationSpeed * 0.3); // Pause longer on error
        } else {
            // --- Phase 4: Normal Decoding ---
            setStatus(`<i class="bi bi-cpu me-1"></i>Decoding signal for bit ${bitIndex + 1}...`, "active");
            actualDecodedBit = calculateDecodingForBit(newSignalPoints, bitIndex);
             // Check for decoding mismatch (e.g., invalid Manchester transition)
            if (actualDecodedBit === '?') {
                 setStatus(`<i class="bi bi-exclamation-triangle-fill me-1"></i>Decoding error for bit ${bitIndex + 1}! Invalid signal pattern.`, 'warning');
                 bitHadError = true; // Treat as error for highlighting etc.
                 bitErrors.push(bitIndex);
                  drawSignal(processedData, signalDataPoints, technique, bitIndex + 1, bitErrors); // Show error marker
            } else if(actualDecodedBit !== currentBit && !bitHadError) {
                 // This indicates a potential logic bug in encoder/decoder pair if no error was injected
                 console.warn(`Potential Logic Error: Encoded '${currentBit}', Decoded '${actualDecodedBit}' for bit ${bitIndex}`);
                 // Could optionally flag this as a different type of error
            }
        }

        unhighlightStageCard(signalCanvas);
        highlightStageCard(decoderBox);
        decoderBox.classList.add('active');
        updateEncoderDecoderState('decoder'); // Update state display (less relevant usually)
        decodedBits.push(actualDecodedBit);
        decodedBitEl.textContent = actualDecodedBit;
        highlightBinarySpan(decodedBinaryAnimatedEl, bitIndex, bitHadError ? 'highlight-error' : 'highlight-decoded', true);


        // --- Cleanup for next step ---
         // Mark source as processed (use original index)
        highlightBinarySpan(binaryInputAnimatedEl, originalBitIndex, 'highlight-processed');
        if (needsStuffing) {
            highlightBinarySpan(stuffedDataEl, bitIndex, stuffedIndices.includes(bitIndex) ? 'highlight-stuffed' : 'highlight-processed');
        }

        await delay(animationSpeed * 0.1); // Brief pause after decoding shown
        decoderBox.classList.remove('active');
        unhighlightStageCard(decoderBox);
        encodingBitEl.textContent = '--';
        decodedBitEl.textContent = '--';
        currentSignalLevelEl.textContent = 'N/A';


        currentStep++;

        if (currentStep >= totalSteps) {
            completeAnimation();
        } else {
             setStatus(`<i class="bi bi-arrow-right-circle me-1"></i>Ready for bit ${currentStep + 1}...`, "info");
        }
    }

    function completeAnimation() {
        clearInterval(animationIntervalId);
        animationIntervalId = null;
        setStatus(`<i class="bi bi-check-circle-fill me-1"></i>Animation Complete! ${totalSteps} bits processed. ${bitErrors.length} error(s) encountered.`, bitErrors.length > 0 ? "warning" : "success");
        encoderBox.classList.remove('active');
        decoderBox.classList.remove('active');
        unhighlightStageCard(encoderBox); // Ensure all highlights removed
        unhighlightStageCard(decoderBox);
        unhighlightStageCard(signalCanvas);
        pauseResumeBtn.disabled = true;
        injectErrorBtn.disabled = true;


        // Final Destuffing
        destuffedBits = '';
        let destuffError = false;
        if (needsStuffing) {
             try {
                 destuffedBits = destuffingFn(decodedBits.join(''));
                 destuffedDataEl.innerHTML = `<span>${formatBinaryString(destuffedBits)}</span>`;
                 destuffingTypeLabel.textContent = isBitStuffing ? 'Bit Destuffing' : 'Byte Stuffing';
                  // Calculate removed bits
                 const removedCount = decodedBits.length - destuffedBits.length;
                 destuffedBitCountEl.textContent = `${removedCount} bits removed`;
                 destuffedBitCountEl.classList.toggle('text-danger', removedCount === 0 && stuffedIndices.length > 0); // Show error if stuffing happened but nothing removed
             } catch (e) {
                 console.error("Destuffing error:", e);
                 destuffedDataEl.textContent = "Error during destuffing.";
                 destuffingTypeLabel.textContent = "Error";
                 destuffError = true;
             }
        } else {
             destuffedBits = decodedBits.join(''); // No destuffing needed
             destuffedDataEl.textContent = 'N/A';
             destuffingTypeLabel.textContent = 'N/A';
             destuffedBitCountEl.textContent = '';
        }

        // Final Message Conversion
        const finalBinaryToConvert = destuffedBits;
        if (destuffError || finalBinaryToConvert.length === 0) {
             finalMessageEl.textContent = "(No valid output due to errors or empty data)";
        } else {
             try {
                 const wasOriginallyText = (!/^[01\s]+$/.test(originalMessage));
                 if (wasOriginallyText && finalBinaryToConvert.length >= 8 && finalBinaryToConvert.length % 8 === 0) {
                     finalMessage = binaryToText(finalBinaryToConvert);
                     finalMessageEl.textContent = finalMessage;
                 } else {
                     finalMessageEl.textContent = `${formatBinaryString(finalBinaryToConvert)}`;
                 }
             } catch (e) {
                 finalMessageEl.textContent = "Error decoding final binary to text.";
                 console.error("Final decode error:", e);
             }
        }
          // Check if final message matches original binary (if input was binary)
         if (/^[01\s]+$/.test(originalMessage) && !needsStuffing && !destuffError && bitErrors.length === 0) {
              if (binaryData === finalBinaryToConvert) {
                   finalMessageEl.closest('.alert').classList.replace('alert-success', 'alert-success'); // Keep success
                   finalMessageEl.textContent += "\n(Matches original bitstream)";
              } else {
                   finalMessageEl.closest('.alert').classList.replace('alert-success', 'alert-danger');
                   finalMessageEl.textContent += "\n(Mismatch with original bitstream!)";
              }
         } else if (bitErrors.length > 0 || destuffError) {
             finalMessageEl.closest('.alert').classList.replace('alert-success', 'alert-danger');
         }


    } // End completeAnimation

    function resetAnimation() {
        clearInterval(animationIntervalId);
        animationIntervalId = null;
        isPaused = true;

        currentStep = 0; totalSteps = 0; // etc... clear all state vars
        originalMessage = ''; binaryData = ''; stuffedData = ''; stuffedIndices = []; processedData = '';
        signalDataPoints = []; decodedBits = []; bitErrors = []; destuffedBits = ''; finalMessage = '';
        needsStuffing = false; isBitStuffing = false; requiresNRZLVisualization = false;
        previousLevelNRZI = -1; levelBeforeIntervalDiffMan = -1; injectErrorNext = false;


        visualizationSection.classList.add('d-none');
        controlsSection.classList.add('d-none');
        inputError.classList.add('d-none');
        setStatus('<i class="bi bi-info-circle-fill me-1"></i>Enter data and press Start.', 'info');
        originalInputEl.textContent = '';
        binaryInputAnimatedEl.textContent = '';
        stuffedDataEl.textContent = '';
        stuffedBitCountEl.textContent = '';
        encodingBitEl.textContent = '--';
        decodedBitEl.textContent = '--';
        decodedBinaryAnimatedEl.textContent = '';
        destuffedDataEl.textContent = '';
        destuffedBitCountEl.textContent = '';
        finalMessageEl.textContent = '';
        stuffingTypeEl.textContent = 'N/A';
        destuffingTypeLabel.textContent = 'N/A';
        encodingTypeShortEl.textContent = 'N/A';
        currentSignalLevelEl.textContent = 'N/A';
        encoderStateEl.textContent = 'N/A';

        unhighlightStageCard(encoderBox); // Remove active class from all stage cards
        unhighlightStageCard(decoderBox);
        unhighlightStageCard(signalCanvas);


        ctx.clearRect(0, 0, signalCanvas.width, signalCanvas.height);

        updatePauseResumeButton(); // Set button text correctly
        pauseResumeBtn.disabled = true;
        resetBtn.disabled = true;
        injectErrorBtn.disabled = true;
        injectErrorBtn.classList.remove('active');
        startBtn.disabled = false;

        // Reset final message alert style
        finalMessageEl.closest('.alert').classList.remove('alert-danger');
        finalMessageEl.closest('.alert').classList.add('alert-success');
    }

    function togglePauseResume() {
        if (!animationIntervalId && currentStep >= totalSteps) return; // Animation finished

        isPaused = !isPaused;
        updatePauseResumeButton();

        if (isPaused) {
            clearInterval(animationIntervalId); // Stop the interval
            animationIntervalId = null;
            setStatus(`<i class="bi bi-pause-circle-fill me-1"></i>Paused at bit ${currentStep + 1}.`, "warning");
        } else {
            setStatus(`<i class="bi bi-play-circle-fill me-1"></i>Resumed. Processing bit ${currentStep + 1}...`, "info");
            // Restart interval immediately
            animationIntervalId = setInterval(animationStep, animationSpeed);
             // Optional: Trigger one step immediately after resume for responsiveness
             // setTimeout(animationStep, 50);
        }
    }

     function updatePauseResumeButton() {
         if (isPaused) {
            pauseResumeBtn.innerHTML = '<i class="bi bi-play-fill me-1"></i>Resume';
            pauseResumeBtn.classList.remove('btn-warning');
            pauseResumeBtn.classList.add('btn-success');
        } else {
            pauseResumeBtn.innerHTML = '<i class="bi bi-pause-fill me-1"></i>Pause';
            pauseResumeBtn.classList.remove('btn-success');
            pauseResumeBtn.classList.add('btn-warning');
        }
     }


    function updateSpeed() {
        animationSpeed = parseInt(speedControl.value, 10);
        updateSpeedValue(animationSpeed);
        if (animationIntervalId && !isPaused) { // Only restart if running and not paused
            clearInterval(animationIntervalId);
            animationIntervalId = setInterval(animationStep, animationSpeed);
        }
    }

     function updateSpeedValue(value) {
         speedValue.textContent = `(${value}ms)`;
     }

     function setStatus(message, type = "info") {
         // Use innerHTML to allow Bootstrap icons
         statusDisplay.innerHTML = message;
         // Determine alert class based on type
         let alertClass = 'alert-info'; // Default
         if (type === 'success') alertClass = 'alert-success';
         else if (type === 'warning') alertClass = 'alert-warning';
         else if (type === 'error') alertClass = 'alert-danger';
         else if (type === 'active') alertClass = 'alert-primary'; // Use primary for active processing

         statusDisplay.className = `alert ${alertClass} flex-grow-1 text-center mb-0 py-1 px-2 status-alert`;
     }

     function updateEncoderDecoderState(stage, tech = technique, nrziState = previousLevelNRZI, diffManState = levelBeforeIntervalDiffMan) {
         let stateText = 'N/A';
          if (stage === 'encoder') {
             if (tech === 'nrzi') {
                 stateText = `Prev Level: ${nrziState === 1 ? '+V' : '-V'}`;
             } else if (tech === 'diffmanchester') {
                 stateText = `Level Before: ${diffManState === 1 ? '+V' : '-V'}`;
             }
             encoderStateEl.textContent = stateText;
         } else {
              // Decoder state usually less relevant to display explicitly
              // Can add logic here if needed
         }
     }

      function getCurrentLevelText(points) {
           if (!points || points.length === 0) return 'N/A';
           // For Manchester/DiffMan, show transition if exists
           if (points.length > 1 && points[0].time !== points[1].time) { // Check time too
                const l1 = points[0].level === 1 ? '+V' : '-V';
                const l2 = points[1].level === 1 ? '+V' : '-V';
                return `${l1} -> ${l2}`;
           } else {
                // For NRZ or single-level part
                return points[points.length - 1].level === 1 ? '+V' : '-V';
           }
       }


    // --- Data Preparation and Setup ---

    function getInputData() {
        console.log("getInputData called."); // DEBUG LOG
        const rawData = dataInput.value.trim();
        console.log("Raw data after trim:", `"${rawData}"`); // DEBUG LOG
        const selectedInputType = document.querySelector('input[name="inputType"]:checked').value;
        originalMessage = rawData;

        // --- Bug Fix Check ---
        if (rawData === '') { // Explicit check for empty string
            console.error("Input is empty!"); // DEBUG LOG
            setStatus('<i class="bi bi-exclamation-triangle-fill me-1"></i>Error: Input data cannot be empty.', "error");
            inputError.textContent = "Input data cannot be empty.";
            inputError.classList.remove('d-none');
            return false;
        }
         // --- End Bug Fix Check ---

        inputError.classList.add('d-none');
        console.log("Input seems valid."); // DEBUG LOG

        // Type detection/conversion (same as V2)
         if (selectedInputType === 'bitstream') {
            if (!/^[01]+$/.test(rawData)) {
                 setStatus('<i class="bi bi-exclamation-triangle-fill me-1"></i>Error: Invalid bitstream input. Use only 0s and 1s.', "error");
                inputError.textContent = "Invalid bitstream. Use only 0s and 1s.";
                 inputError.classList.remove('d-none');
                return false;
            }
            binaryData = rawData;
        } else { // Auto-detect or forced text
             if (/^[01\s]+$/.test(rawData)) {
                 binaryData = rawData.replace(/\s/g, '');
                 if (!/^[01]+$/.test(binaryData) || binaryData.length === 0) { // Also check if empty after space removal
                    setStatus('<i class="bi bi-info-circle-fill me-1"></i>Input treated as text (contained non-binary or was empty after removing spaces).', "warning");
                    binaryData = textToBinary(rawData);
                 } else {
                     originalMessage = `Bitstream: ${binaryData.substring(0,50)}...`;
                 }
             } else { // Treat as text
                 binaryData = textToBinary(rawData);
             }
        }


        if (!binaryData) {
             setStatus('<i class="bi bi-x-octagon-fill me-1"></i>Error: Could not convert input to binary data.', "error");
            return false;
        }
        console.log("Binary data generated:", binaryData.substring(0, 100) + (binaryData.length > 100 ? '...' : '')); // DEBUG LOG
        return true;
    }

    function prepareData() {
        // Reset stuffing related state
        needsStuffing = false; requiresNRZLVisualization = false; isBitStuffing = false;
        stuffedData = ''; stuffedIndices = [];
        processedData = binaryData; // Start with original binary

        encodingName = techniqueSelect.options[techniqueSelect.selectedIndex].text;
        let shortEncodingName = technique.toUpperCase(); // Default short name

         switch (technique) {
            case 'nrzl': encodingFn = encodeNRZLBit; decodingFn = decodeNRZLSignal; shortEncodingName = "NRZ-L"; break;
            case 'nrzi': encodingFn = encodeNRZIBit; decodingFn = decodeNRZISignal; shortEncodingName = "NRZ-I"; break;
            case 'manchester': encodingFn = encodeManchesterBit; decodingFn = decodeManchesterSignal; shortEncodingName = "MANCH"; break;
            case 'diffmanchester': encodingFn = encodeDiffManchesterBit; decodingFn = decodeDiffManchesterSignal; shortEncodingName = "DIFF"; break;
            case 'bitstuff':
                needsStuffing = true; isBitStuffing = true; requiresNRZLVisualization = true;
                stuffingFn = bitStuffDetailed; // Use detailed version
                destuffingFn = bitDestuff; // Standard destuffing is okay
                let bitStuffResult = stuffingFn(binaryData); // Get object with stuffed data and indices
                stuffedData = bitStuffResult.stuffed;
                stuffedIndices = bitStuffResult.stuffedIndices;
                processedData = stuffedData;
                encodingFn = encodeNRZLBit; decodingFn = decodeNRZLSignal;
                encodingName = `Bit Stuffing (using NRZ-L)`; shortEncodingName = "BIT+NRZL";
                break;
            case 'bytestuff':
                 needsStuffing = true; isBitStuffing = false; requiresNRZLVisualization = true;
                 stuffingFn = (d) => byteStuffDetailed(d, FLAG, ESC); // Use detailed version
                 destuffingFn = (d) => byteDestuff(d, FLAG, ESC);
                 let byteStuffResult = stuffingFn(binaryData);
                 stuffedData = byteStuffResult.stuffed;
                 stuffedIndices = byteStuffResult.stuffedIndices; // Indices of ESC bytes or Flags within data
                 processedData = stuffedData;
                 encodingFn = encodeNRZLBit; decodingFn = decodeNRZLSignal;
                 encodingName = `Byte Stuffing (using NRZ-L)`; shortEncodingName = "BYTE+NRZL";
                 break;
            default:
                setStatus('<i class="bi bi-x-octagon-fill me-1"></i>Error: Unknown technique selected.', "error");
                processedData = ''; return;
        }
         encodingTypeShortEl.textContent = shortEncodingName; // Update short name in encoder box
    }

     function setupVisualizationUI() {
        startBtn.disabled = true; resetBtn.disabled = false; pauseResumeBtn.disabled = false; injectErrorBtn.disabled = false;

        originalInputEl.textContent = originalMessage.length > 100 ? originalMessage.substring(0, 97) + '...' : originalMessage;
        binaryInputAnimatedEl.innerHTML = binaryData.split('').map((bit, index) => `<span id="bin-in-${index}">${bit}</span>`).join('');
        decodedBinaryAnimatedEl.innerHTML = ''; // Clear initially

        if (needsStuffing) {
            // Highlight stuffed bits/bytes using stuffedIndices
            let stuffedHtml = '';
            let currentStuffedIndex = 0;
            for(let i = 0; i < processedData.length; i++) {
                const isStuffed = stuffedIndices.includes(i);
                const bit = processedData[i];
                // Group bytes for byte stuffing visualization
                const isStartOfByte = i % 8 === 0;
                const isEndOfByte = (i + 1) % 8 === 0;
                if(isStartOfByte && !isBitStuffing && i !== 0) stuffedHtml += ' '; // Add space between bytes

                stuffedHtml += `<span id="stuff-in-${i}" class="${isStuffed ? 'highlight-stuffed' : ''}">${bit}</span>`;
            }
            stuffedDataEl.innerHTML = stuffedHtml;
            stuffingTypeEl.textContent = isBitStuffing ? 'Bit Stuffing' : 'Byte Stuffing';
            stuffedBitCountEl.textContent = `${stuffedIndices.length} bits added`; // Show count of added bits/bytes
        } else {
            stuffedDataEl.textContent = 'N/A';
            stuffingTypeEl.textContent = 'N/A';
            stuffedBitCountEl.textContent = '';
        }

        encodingTypeEl.textContent = encodingName; // Full name for canvas title
        transmissionMediumLabel.textContent = transmissionType.charAt(0).toUpperCase() + transmissionType.slice(1);
        signalCanvas.className = transmissionType;
    }

    // --- Animation Helpers ---
    async function animateBitDrop(originalBitIndex, bitValue) {
        const sourceSpan = document.getElementById(`bin-in-${originalBitIndex}`);
        const encoderRect = encoderBox.getBoundingClientRect();

        if (!sourceSpan) return; // Skip if source span not found

        const sourceRect = sourceSpan.getBoundingClientRect();

        const bitElement = document.createElement('div');
        bitElement.className = 'bit-drop-element';
        bitElement.textContent = bitValue;
        bitDropArea.appendChild(bitElement);

        // Initial position: over the source bit
        bitElement.style.left = `${sourceRect.left + window.scrollX + sourceRect.width / 2 - bitElement.offsetWidth / 2}px`;
        bitElement.style.top = `${sourceRect.top + window.scrollY}px`;
        bitElement.style.opacity = '1';

        // Force reflow to apply initial style before transition
        void bitElement.offsetWidth;

        // Target position: center of the encoder box
        const targetLeft = encoderRect.left + window.scrollX + encoderRect.width / 2 - bitElement.offsetWidth / 2;
        const targetTop = encoderRect.top + window.scrollY + encoderRect.height / 2 - bitElement.offsetHeight / 2;

        bitElement.style.left = `${targetLeft}px`;
        bitElement.style.top = `${targetTop}px`;
        bitElement.style.opacity = '0';

        // Wait for animation to finish (slightly longer than CSS duration)
        await delay(600);

        bitDropArea.removeChild(bitElement); // Clean up
    }

     function highlightStageCard(element) {
         // Find the parent card element and add 'active' class
         const card = element.closest('.stage-card');
         if (card) {
             // Remove active from others first
             document.querySelectorAll('.stage-card.active').forEach(c => c.classList.remove('active'));
             card.classList.add('active');
         }
     }
      function unhighlightStageCard(element) {
         const card = element.closest('.stage-card');
         if (card) card.classList.remove('active');
     }

     function findOriginalBitIndex(processedIndex) {
         // Basic approximation: If not stuffing, index is the same.
         // If stuffing, it's harder to map back accurately without detailed tracking.
         // Return processedIndex for now, or -1 if it's clearly a stuffed bit.
         if (!needsStuffing) return processedIndex;
         if (stuffedIndices.includes(processedIndex)) return -1; // Don't animate stuffed bits

         // Estimate original index by counting non-stuffed bits up to this point
         let originalIndex = -1;
         let nonStuffedCount = 0;
         for(let i=0; i <= processedIndex; i++) {
             if (!stuffedIndices.includes(i)) {
                 nonStuffedCount++;
             }
         }
         originalIndex = nonStuffedCount - 1;

         return originalIndex >= 0 ? originalIndex : -1; // Return -1 if calculation fails
     }


     function delay(ms) {
         return new Promise(resolve => setTimeout(resolve, ms));
     }


    // --- Incremental Encoding/Decoding (Keep bit-level functions from V2) ---
     function calculateEncodingForBit(bit, index) { return encodingFn(bit, index); }
     function calculateDecodingForBit(signalPointsForThisBit, index) { return decodingFn(signalPointsForThisBit, index); }
     // --- Include Bit-level Encoding/Decoding functions (encodeNRZLBit, etc.) ---
     // --- PASTE bit-level encode/decode functions HERE ---
        function encodeNRZLBit(bit, index) { const level = bit === '1' ? 1 : -1; return [{ time: index, level: level }]; }
        function encodeNRZIBit(bit, index) { if (bit === '1') { previousLevelNRZI *= -1; } return [{ time: index, level: previousLevelNRZI }]; }
        function encodeManchesterBit(bit, index) { const points = []; if (bit === '0') { points.push({ time: index + 0.0, level: 1 }); points.push({ time: index + 0.5, level: -1 }); } else { points.push({ time: index + 0.0, level: -1 }); points.push({ time: index + 0.5, level: 1 }); } return points; }
        function encodeDiffManchesterBit(bit, index) { const points = []; if (bit === '0') { levelBeforeIntervalDiffMan *= -1; } points.push({ time: index + 0.0, level: levelBeforeIntervalDiffMan }); levelBeforeIntervalDiffMan *= -1; points.push({ time: index + 0.5, level: levelBeforeIntervalDiffMan }); return points; }
        function decodeNRZLSignal(points, index) { if (!points || points.length === 0) return '?'; return points[0].level === 1 ? '1' : '0'; }
        function decodeNRZISignal(points, index) { if (!points || points.length === 0) return '?'; const currentLevel = points[0].level; let levelBeforeThisBit; if (index === 0) { levelBeforeThisBit = -1; /* Assume start */} else { const prevPoint = signalDataPoints.slice().reverse().find(p => p.time < index); levelBeforeThisBit = prevPoint ? prevPoint.level : -1;} const decoded = (currentLevel !== levelBeforeThisBit) ? '1' : '0'; return decoded; }
        function decodeManchesterSignal(points, index) { if (points.length < 2) return '?'; const firstHalfLevel = points[0].level; const secondHalfLevel = points[1].level; if (firstHalfLevel === -1 && secondHalfLevel === 1) return '1'; if (firstHalfLevel === 1 && secondHalfLevel === -1) return '0'; return '?'; }
        function decodeDiffManchesterSignal(points, index) { if (points.length < 2) return '?'; const firstHalfLevel = points[0].level; let levelBeforeThisBit; if (index === 0) { levelBeforeThisBit = -1; } else { const prevPoint = signalDataPoints.slice().reverse().find(p => p.time < index); levelBeforeThisBit = prevPoint ? prevPoint.level : -1;} if (firstHalfLevel !== levelBeforeThisBit) { return '0'; } else { return '1'; } }
     // --- END bit-level encode/decode functions ---



    // --- UI Update Helpers ---
     function highlightBinarySpan(parentElement, index, cssClass, append = false) {
         if (index === -1 && !append) return; // Don't highlight if index is invalid (e.g., stuffed bit source)

         const spanIdPrefix = parentElement.id.startsWith('bin-in') ? 'bin-in-' : (parentElement.id.startsWith('stuff-in') ? 'stuff-in-' : 'dec-out-');
         const targetIndex = append ? decodedBits.length - 1 : index; // Use last decoded bit index if appending
         const spanId = `${spanIdPrefix}${targetIndex}`;

         let span = parentElement.querySelector(`#${spanId}`);

         if (append && parentElement === decodedBinaryAnimatedEl && !span) {
             // Append new span for decoded output
             span = document.createElement('span');
             span.id = spanId;
             span.textContent = decodedBits[targetIndex]; // Get the just decoded bit
             parentElement.appendChild(span);
              // Add space every 8 bits
             if ((targetIndex + 1) % 8 === 0 && targetIndex !== totalSteps - 1) {
                 parentElement.appendChild(document.createTextNode(' '));
             }
         }

         if (span) {
             // Manage classes carefully
             span.classList.remove('highlight-current', 'highlight-processed', 'highlight-decoded', 'highlight-error', 'highlight-stuffed');
             if (cssClass) { // Add new class if provided
                 span.classList.add(cssClass);
             }
         }
    }


    // --- Canvas Drawing (Modified for Errors) ---
    function drawSignal(originalBits, currentSignalPoints, technique, bitsToShow, errors = []) {
        // ... (Setup: width, height, padding, usableWidth/Height, zeroLevelY, amplitude, timeScale - same as V2) ...
        const width = signalCanvas.width; const height = signalCanvas.height; const padding = 40;
        const usableWidth = width - 2 * padding; const usableHeight = height - 2 * padding;
        const zeroLevelY = height / 2; const amplitude = usableHeight / 3;
        const totalBitsInStream = originalBits.length;
        const timeScale = totalBitsInStream > 0 ? usableWidth / totalBitsInStream : usableWidth;

        // Colors from CSS Variables or defaults
        const signalColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim() || '#0077b6';
        const highColor = getComputedStyle(document.documentElement).getPropertyValue('--danger-color').trim() || '#e76f51';
        const lowColor = signalColor; // Use primary blue for low level too
        const gridColor = '#E0E0E0'; const axisColor = '#333333';
        const bitBoundaryColor = '#6c757d'; const transitionColor = '#adb5bd';
        const errorColor = getComputedStyle(document.documentElement).getPropertyValue('--danger-color').trim() || '#e76f51';


        ctx.clearRect(0, 0, width, height);
        // Redraw background
        const currentBg = window.getComputedStyle(signalCanvas).getPropertyValue('background');
        ctx.fillStyle = currentBg || '#ffffff'; // Use computed background
        ctx.fillRect(0, 0, width, height);
         // Redraw wired line if needed
         if (signalCanvas.classList.contains('wired')) {
            ctx.fillStyle = '#adb5bd';
            ctx.fillRect(padding, height - padding * 0.7, usableWidth, 3);
         }

        // --- Draw Axes --- (Same as V2)
         ctx.strokeStyle = axisColor; ctx.lineWidth = 1; ctx.beginPath();
         ctx.moveTo(padding, padding / 2); ctx.lineTo(padding, height - padding / 2); // Y
         ctx.moveTo(padding, zeroLevelY); ctx.lineTo(width - padding, zeroLevelY); // X
         ctx.stroke();
         ctx.fillStyle = axisColor; ctx.font = "11px Arial"; ctx.textAlign = "right";
         ctx.fillText("+V", padding - 8, zeroLevelY - amplitude + 4);
         ctx.fillText("0", padding - 8, zeroLevelY + 4);
         ctx.fillText("-V", padding - 8, zeroLevelY + amplitude + 4);


        // --- Draw Bit Boundaries and Labels --- (Same logic as V2)
         ctx.lineWidth = 0.5; ctx.fillStyle = axisColor; ctx.font = "10px Courier New"; ctx.textAlign = "center";
         const isManchesterType = technique === 'manchester' || technique === 'diffmanchester';
         for (let i = 0; i <= totalBitsInStream; i++) {
             const x = padding + i * timeScale;
             const isBoundaryToShow = i <= bitsToShow;
             ctx.strokeStyle = isBoundaryToShow ? bitBoundaryColor : gridColor;
             ctx.beginPath(); ctx.moveTo(x, padding * 0.8); ctx.lineTo(x, height - padding * 0.8); ctx.stroke(); // Shorter lines

             if (i < bitsToShow && i < originalBits.length) {
                  const bitCenterX = padding + (i + 0.5) * timeScale;
                  // Attempt to find original bit for label (approximate)
                  const originalSourceIndex = findOriginalBitIndex(i);
                  const bitLabel = (originalSourceIndex !== -1 && originalSourceIndex < binaryData.length) ? binaryData[originalSourceIndex] : '?';
                  ctx.fillText(bitLabel, bitCenterX, padding - 10);
             }
             if (isManchesterType && i < bitsToShow) { /* ... draw mid-bit lines ... */
                  ctx.strokeStyle = transitionColor; ctx.setLineDash([2, 2]);
                  const midX = padding + (i + 0.5) * timeScale;
                  ctx.beginPath(); ctx.moveTo(midX, padding); ctx.lineTo(midX, height - padding); ctx.stroke();
                  ctx.setLineDash([]);
              }
         }


        // --- Draw Signal --- (Same logic as V2 for pathing)
         if (!currentSignalPoints || currentSignalPoints.length === 0) return;
         ctx.strokeStyle = signalColor; ctx.lineWidth = 2; ctx.beginPath();
         let lastPlottedX = padding; let lastPlottedY = zeroLevelY;
         const firstPointX = padding + currentSignalPoints[0].time * timeScale;
         ctx.moveTo(padding, zeroLevelY); ctx.lineTo(firstPointX, zeroLevelY);

         currentSignalPoints.forEach((point, index) => { /* ... V2 logic to draw lines ... */
              const x = padding + point.time * timeScale; const y = zeroLevelY - point.level * amplitude;
              if (index > 0) { const prevX = padding + currentSignalPoints[index - 1].time * timeScale; if (x === prevX && y !== lastPlottedY) { ctx.lineTo(x, y); } else if (x > prevX) { ctx.lineTo(x, lastPlottedY); if (y !== lastPlottedY) { ctx.lineTo(x, y); } } } else { ctx.lineTo(x, y); }
              lastPlottedX = x; lastPlottedY = y;
         });
         const endOfCurrentBitTime = bitsToShow;
         const endX = padding + endOfCurrentBitTime * timeScale;
         if (endX > lastPlottedX) { ctx.lineTo(endX, lastPlottedY); }
         ctx.stroke();


        // --- Draw Error Markers ---
        ctx.fillStyle = errorColor;
        ctx.strokeStyle = errorColor;
        ctx.lineWidth = 1.5;
        errors.forEach(errorIndex => {
            // Mark the bit interval where the error occurred
            const startX = padding + errorIndex * timeScale;
            const endX_ = padding + (errorIndex + 1) * timeScale;
            const midX_ = (startX + endX_) / 2;
            // Draw a small 'X' or circle above the axis
            const markerY = padding - 15; // Position above bit labels
             ctx.beginPath();
             ctx.arc(midX_, markerY, 5, 0, Math.PI * 2); // Circle
             // ctx.moveTo(midX_ - 4, markerY - 4); ctx.lineTo(midX_ + 4, markerY + 4); // Cross
             // ctx.moveTo(midX_ + 4, markerY - 4); ctx.lineTo(midX_ - 4, markerY + 4);
             ctx.stroke();

        });

         // --- Draw Decoder Head Marker --- (Same as V2, maybe different style)
         const decodeHeadX = padding + bitsToShow * timeScale;
         ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; // Darker marker
         ctx.beginPath();
         ctx.moveTo(decodeHeadX - 4, padding * 0.8); ctx.lineTo(decodeHeadX + 4, padding * 0.8);
         ctx.lineTo(decodeHeadX, padding * 0.8 + 8); ctx.closePath(); ctx.fill();


    } // End drawSignal

    // --- Utility Functions (Text/Binary - Keep from previous) ---
    function formatBinaryString(binStr) { /* ... copy from previous ... */ }
    function textToBinary(text) { /* ... copy from previous ... */ }
    function binaryToText(binary) { /* ... copy from previous ... */ }

    // --- Detailed Stuffing/Destuffing (Modified for index tracking) ---
    function bitStuffDetailed(data) {
        let count = 0;
        let stuffed = '';
        const stuffedIndices = []; // Store indices where '0' was inserted
        let outputIndex = 0;
        for (const bit of data) {
            stuffed += bit;
            outputIndex++;
            if (bit === '1') {
                count++;
                if (count === 5) {
                    stuffed += '0'; // Stuff a 0
                    stuffedIndices.push(outputIndex); // Store index of the stuffed '0'
                    outputIndex++;
                    count = 0; // Reset count
                }
            } else {
                count = 0; // Reset count on 0
            }
        }
        return { stuffed, stuffedIndices };
    }
    function bitDestuff(data) { /* ... copy standard V2 version ... */ }

     function byteStuffDetailed(data, flag, esc) {
        let stuffed = flag;
        const stuffedIndices = []; // Store indices where ESC was inserted
        const byteLength = 8;
        let outputIndex = flag.length; // Start after initial flag

        for (let i = 0; i < data.length; i += byteLength) {
            const byte = data.substr(i, byteLength);
             if (byte.length < byteLength) continue;

            if (byte === flag || byte === esc) {
                 stuffed += esc; // Add escape character
                 // Mark indices of the escape byte
                 for(let k=0; k<byteLength; k++) stuffedIndices.push(outputIndex + k);
                 outputIndex += byteLength;
            }
            stuffed += byte;
            outputIndex += byteLength;
        }
        stuffed += flag;
        return { stuffed, stuffedIndices };
    }
     function byteDestuff(data, flag, esc) { /* ... copy standard V2 version ... */ }
     //-------------------------------------------------------

     // --- PASTE standard V2 helper functions HERE ---
    function formatBinaryString(binStr) { if (!binStr) return ''; return binStr.replace(/(.{8})/g, '$1 ').trim(); }
    // textToBinary - Use V2 version
    // binaryToText - Use V2 version
    // bitDestuff - Use V2 version
    // byteDestuff - Use V2 version

    function textToBinary(text) { return text.split('').map(char => char.charCodeAt(0).toString(2).padStart(8, '0')).join(''); }
    function binaryToText(binary) { let text = ''; const paddedBinary = binary.padStart(Math.ceil(binary.length / 8) * 8, '0'); for (let i = 0; i < paddedBinary.length; i += 8) { const byte = paddedBinary.substr(i, 8); if (byte.length === 8) { const charCode = parseInt(byte, 2); if (charCode >= 32 || [9, 10, 13].includes(charCode)) { text += String.fromCharCode(charCode); } else { text += '?'; } } } return text; }
    function bitDestuff(data) { let count = 0; let destuffed = ''; let skipNext = false; for (let i = 0; i < data.length; i++) { if (skipNext) { skipNext = false; continue; } const bit = data[i]; destuffed += bit; if (bit === '1') { count++; if (count === 5) { if (i + 1 < data.length && data[i + 1] === '0') { skipNext = true; count = 0; } else { count = 0; } } } else { count = 0; } } return destuffed; }
    function byteDestuff(data, flag, esc) { let destuffed = ''; const byteLength = 8; let i = 0; if (data.startsWith(flag)) { i = flag.length; } else { console.warn("Byte Destuff: No starting flag found."); } while (i < data.length - flag.length) { const currentByte = data.substr(i, byteLength); if (currentByte.length < byteLength) { console.warn("Byte Destuff: Incomplete byte."); break; } if (currentByte === esc) { i += byteLength; const nextByte = data.substr(i, byteLength); if (nextByte.length < byteLength) { console.warn("Byte Destuff: ESC near end."); break; } destuffed += nextByte; i += byteLength; } else if (currentByte === flag) { console.warn("Byte Destuff: Unexpected flag."); break; } else { destuffed += currentByte; i += byteLength; } } if (i !== data.length - flag.length) { console.warn("Byte Destuff: Did not end cleanly on flag.");} return destuffed; }
    // --- END OF HELPER FUNCTIONS ---

}); // End DOMContentLoaded
document.addEventListener('DOMContentLoaded', function () {
    // Initialize Quill editor with default toolbar options
    const quill = new Quill('#editor', {
        theme: 'snow',
        modules: {
            toolbar: [
                [{ 'header': '1' }, { 'header': '2' }],
                ['bold', 'italic', 'underline'],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                [{ 'script': 'sub' }, { 'script': 'super' }],
                [{ 'indent': '-1' }, { 'indent': '+1' }],
                [{ 'align': [] }],
                ['link', 'image'],
                ['clean']
            ]
        },
        clipboard: {
            matchVisual: false,
        }
    });

    let highlightedIndex = null;
    const closedSuggestions = new Set(); // Store indexes of closed suggestions

    function analyzeContent() {
        const content = quill.getText();
        const resultsDiv = document.getElementById('results');
        resultsDiv.innerHTML = ''; // Clear previous results
        const sentences = content.split(/(?<=[.?!])\s+/);
        let complexSentences = 0;
        let passiveSentences = 0;
        const wordCounts = {};
        let totalWords = 0;
        let totalSyllables = 0;

        sentences.forEach((sentence, index) => {
            // Skip closed suggestions
            if (closedSuggestions.has(index)) {
                return;
            }

            const wordCount = sentence.split(' ').length;
            totalWords += wordCount;
            const syllablesInSentence = countSyllables(sentence);
            totalSyllables += syllablesInSentence;

            if (wordCount > 30) {
                complexSentences++;
                addResult("Long Sentence Detected:", sentence, index, 'long-sentence');
            }

            if (/\bis\b|\bare\b|\bwas\b|\bwere\b|\bbe\b/.test(sentence)) {
                passiveSentences++;
                addResult("Passive Voice Detected:", sentence, index, 'passive-voice');
            }

            // Count overused words
            sentence.split(' ').forEach(word => {
                const cleanedWord = word.toLowerCase().replace(/[.,!?;:]/g, ''); // Clean punctuation
                wordCounts[cleanedWord] = (wordCounts[cleanedWord] || 0) + 1;
            });
        });

        const overusedWords = Object.entries(wordCounts).filter(([_, count]) => count > 5); // Adjust the threshold as needed

        // Calculate and display Flesch-Kincaid Score
        const fleschKincaidScore = calculateFleschKincaid(totalWords, totalSyllables, sentences.length);
        displayReadabilityResults(fleschKincaidScore, passiveSentences, overusedWords);

        updateProgressBars(complexSentences, passiveSentences, sentences.length); // Update progress bars
        setupHighlighting();
    }

    function calculateFleschKincaid(totalWords, totalSyllables, totalSentences) {
        if (totalSentences === 0) return 0; // Prevent division by zero
        const ASL = totalWords / totalSentences; // Average Sentence Length
        const ASW = totalSyllables / totalWords; // Average Syllables per Word
        return 206.835 - (1.015 * ASL) - (84.6 * ASW);
    }

    function countSyllables(word) {
        const matches = word.match(/[aeiouy]{1,2}/gi);
        return matches ? matches.length : 0;
    }

    function displayReadabilityResults(fleschKincaidScore, passiveSentences, overusedWords) {
        document.getElementById('readability-score').textContent = `Flesch-Kincaid Score: ${fleschKincaidScore.toFixed(2)}`;
        document.getElementById('grammar-errors').textContent = `Grammar Errors: ${passiveSentences}`;
        
        const overusedWordsList = document.getElementById('overused-words');
        overusedWordsList.innerHTML = ''; // Clear previous results
        overusedWords.forEach(([word, count]) => {
            const item = document.createElement('div');
            item.textContent = `${word}: ${count}`;
            overusedWordsList.appendChild(item);
        });
    }

    function addResult(title, sentence, index, type) {
        const resultsDiv = document.getElementById('results');
        const resultDiv = document.createElement('div');
        resultDiv.className = `result ${type}`;
        resultDiv.dataset.index = index; // Store the index
        resultDiv.innerHTML = 
            `<div class="result-title">${title}</div>
            <div class="result-content">
                <span>"${sentence}"</span>
            </div>
            <div class="remove-suggestion-container">
                <button class="remove-suggestion">X</button>
            </div>`;
        resultsDiv.appendChild(resultDiv);

        // Add click event listener for the remove button
        resultDiv.querySelector('.remove-suggestion').addEventListener('click', function(event) {
            event.stopPropagation(); // Prevent the event from bubbling up
            removeResult(index); // Call removeResult
        });
    }

    function removeResult(index) {
        console.log(`Removing result at index: ${index}`); // Debugging log

        // Mark the index as closed
        closedSuggestions.add(index);

        // Remove highlight from the editor
        removeHighlight(index);

        // Remove the specific result element
        const resultElement = document.querySelector(`.result[data-index="${index}"]`);
        if (resultElement) {
            console.log("Found result element to remove:", resultElement); // Debugging log
            resultElement.remove();
        } else {
            console.log("No result element found for index:", index); // Debugging log
        }

        // Update progress bars after removal
        updateProgressBarsAfterRemoval();
    }

    function updateProgressBarsAfterRemoval() {
        const content = quill.getText();
        const sentences = content.split(/(?<=[.?!])\s+/);
        const newResults = {
            longSentences: 0,
            passiveSentences: 0
        };

        sentences.forEach((sentence, index) => {
            // Skip closed suggestions
            if (closedSuggestions.has(index)) {
                return;
            }

            const wordCount = sentence.split(' ').length;

            if (wordCount > 30) { // Adjust threshold if needed
                newResults.longSentences++;
            }

            if (/\bis\b|\bare\b|\bwas\b|\bwere\b|\bbe\b/.test(sentence)) {
                newResults.passiveSentences++;
            }
        });

        updateProgressBars(newResults.longSentences, newResults.passiveSentences, sentences.length);
    }

    function updateProgressBars(complexSentences, passiveSentences, totalSentences) {
        if (totalSentences === 0) return; // Prevent division by zero
        const longSentencePercentage = (complexSentences / totalSentences) * 100;
        const passiveSentencePercentage = (passiveSentences / totalSentences) * 100;

        // Update the progress bars' width
        document.getElementById('long-sentences-bar').style.width = `${longSentencePercentage}%`;
        document.getElementById('passive-sentences-bar').style.width = `${passiveSentencePercentage}%`;
        
        // Update the text that shows the percentage
        document.querySelector('#long-sentences-bar + .progress-bar-text').textContent = `${Math.round(longSentencePercentage)}%`;
        document.querySelector('#passive-sentences-bar + .progress-bar-text').textContent = `${Math.round(passiveSentencePercentage)}%`;
    }

    function setupHighlighting() {
        document.querySelectorAll('.result-content').forEach(element => {
            const index = element.closest('.result').dataset.index;

            element.addEventListener('mouseenter', () => {
                highlightSentence(index);
                highlightedIndex = index;
            });

            element.addEventListener('mouseleave', () => {
                removeHighlight(index);
                highlightedIndex = null;
            });
        });
    }

    function highlightSentence(index) {
        if (highlightedIndex !== null) removeHighlight(highlightedIndex);
        const content = quill.getText();
        const sentences = content.split(/(?<=[.?!])\s+/);
        const sentence = sentences[index];
        const range = quill.getText().indexOf(sentence);
        quill.formatText(range, sentence.length, { background: '#c5d3c5' });
    }

    function removeHighlight(index) {
        const content = quill.getText();
        const sentences = content.split(/(?<=[.?!])\s+/);
        const sentence = sentences[index];
        const range = quill.getText().indexOf(sentence);
        quill.formatText(range, sentence.length, { background: '#f2e6d9' });
    }

    quill.on('text-change', analyzeContent);
});

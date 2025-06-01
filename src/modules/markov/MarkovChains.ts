import "../../utils/deleteAt";

type WordList = Map<string, {
    original: string;
    list: string[];
}>;

export default class MarkovChains {
    public wordList: WordList;
    
    /**
     * @param wordList A custom dictionary.
     */
    constructor(wordList?: WordList) {
        this.wordList = wordList ?? new Map();
    }

    /**
     * Maps the words to generate sentences.
     * @param texts An array of texts.
     */
    generateDictionary(texts: string[]): void {
        this.wordList = new Map();
        texts.forEach(text => this.pickWords(text));
    }

    /**
     * Generates a sentence.
     * @param max Maximum words in the sentence.
     * @returns Generated sentence.
     */
    generateChain(max: number, chaos: number = 0.5): string {
        const wordArray = Array.from(this.wordList.keys());
        if (wordArray.length < 1) return "";

        let lastWord: string | undefined;
        let generatedWords: string[] = [];

        while (!lastWord) {
            const entry = this.wordList.get(wordArray[Math.floor(Math.random() * wordArray.length)]);
            if (entry) lastWord = entry.original;
        }

        generatedWords.push(lastWord);

        for (let i = 0; i < max - 1; i++) {
            if (!lastWord) break;

            if (Math.random() < chaos * 0.2) {
                const randomEntry = this.wordList.get(wordArray[Math.floor(Math.random() * wordArray.length)]);
                if (randomEntry) {
                    lastWord = randomEntry.original;
                    generatedWords.push(lastWord);
                    continue;
                }
            }

            const next = this.wordList.get(this.parseKey(lastWord));
            if (!next || next.list.length === 0) break;

            let nextIndex = Math.floor(
                Math.pow(Math.random(), 1 - chaos) * next.list.length
            );

            lastWord = next.list[nextIndex];
            generatedWords.push(lastWord);
            
            if (Math.random() < chaos * 0.1) {
                generatedWords.push(lastWord);
            }
        }

        return this.filterGeneratedText(generatedWords.join(" "));
    }

    /**
     * Extracts the words from the text and put them in the dictionary.
     * @param text Text to extract the words.
     */
    private pickWords(text: string) {
        let splittedWords: string[] = text.split(/ +/g);
        splittedWords.forEach((word, i) => {
            let wordKey = this.parseKey(word);
            if (!wordKey) return;

            let nextWord = splittedWords[i + 1];

            if (!this.wordList.get(wordKey)) {
                this.wordList.set(wordKey, {
                    original: word,
                    list: []
                });
            }

            if (nextWord) this.wordList.get(wordKey).list.push(nextWord);
        });
    }

    /**
     * Filters the word to a key.
     * @param word The word to be filtered.
     * @returns Filtered word.
     */
    private parseKey(word: string): string {
        // Only replace if there are any letters
        if (/\w/.test(word))
            word = word.replace(/[<>()[\]{}:;\.,]/g, "");

        return word;
    }

    /**
     * Filters the generated text by removing incomplete or nonsense punctuations.
     * @param text Text do be filtered.
     * @returns Filtered text.
     */
    private filterGeneratedText(text: string): string {
        text = text.trim();

        // Deletes unclosed parentheses, brackets and curly braces
        [["(", ")"], ["[", "]"], ["{", "}"]].forEach(v => {
            text = this.removeUnclosedPairs(text, v);
        });
        
        // Deletes unclosed quotes and markdown
        ["\"", "'", "`", "*"].forEach(v => {
            text = this.removeUnclosedQuotes(text, v);
        });

        // Deletes punctuations at beginning and end
        if (/\w/.test(text))
            text = text.replace(/^[\.,; ]+/g, "").replace(/[, ]+$/g, "");

        return text;
    }

    /**
     * Deletes unclosed quotes or markdown.
     * @param text Text to be filtered.
     * @param char Character to check.
     * @returns Filtered text.
     */
    private removeUnclosedQuotes(text: string, char: string): string {
        let count = 0;
        let lastIndex;
    
        for (let i=0; i < text.length; i++) {
            if (text[i] == char) {
                lastIndex = i;
    
                count++;
            }
        }
    
        if (count % 2 != 0) text = text.deleteAt(lastIndex);
    
        return text;
    }

    /**
     * Deletes unclosed characters, such as parentheses or brackets.
     * @param text Text to be filtered.
     * @param pair Pair to check.
     * @returns Filtered text.
     */
    private removeUnclosedPairs(text: string, pair: string[]): string {
        let count = 0;
    
        for (let i=0; i < text.length; i++) {
            if (text[i] == pair[0]) {
                count++;
            } else if (text[i] == pair[1]) {
                count--;
            }
    
            if (count < 0) {
                return this.removeUnclosedPairs(text.deleteAt(i), pair);
            }
        }
    
        if (count > 0) {
            for (let i=0; i < text.length; i++) {
                if (text[i] == pair[0]) {
                    return this.removeUnclosedPairs(text.deleteAt(i), pair);
                }
            }
        }
    
        return text;
    }
}
import "../../utils/deleteAt"; // Assuming this is a custom String.prototype.deleteAt = function(index) { return this.slice(0, index) + this.slice(index + 1); };
import render from "@aduh95/viz.js"; // For DOT file visualization (Node.js)
import toImage from "@aduh95/viz.js"; // For DOT file visualization (Node.js)
import { writeFileSync as fsWriteFileSync } from "fs"; // For saving DOT file (Node.js)

// BOT POWERED BY JEMITIES AND CHAT GIPPITY 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥

const COMMON_WORDS = new Set([
    "the", "you", "and", "to", "a", "of", "in", "is", "i", "that", "it",
    "on", "for", "was", "with", "as", "but", "be", "at", "by", "are",
    "this", "they", "have", "from", "or", "one", "had", "he", "she", "we",
    "were", "my", "what", "there", "all", "if", "when", "your", "can",
    "said", "so", "out", "about", "who", "got", "like", "get", "just",
    "would", "could", "do", "don't", "did", "them", "his", "her", "its",
    "how", "than", "been", "then", "even", "now", "only", "down", "up"
]);

const PUNCTUATION_MARKS = new Set([".", ",", ";", ":", "!", "?"]);

const MAX_NEXT_WORDS = 150; // Increased for more options
const TRIGRAM_FREQUENCY: Record<string, number> = {}; // Used for weighting start trigrams

function getRandomUnicodeSymbol(): string {
    // Generates a random displayable Unicode symbol (expanded ranges)
    const ranges = [
        [0x2600, 0x26FF], // Miscellaneous Symbols
        [0x1F300, 0x1F6FF], // Miscellaneous Symbols and Pictographs, Emoticons, Transport and Map Symbols
        [0x1F900, 0x1F9FF], // Supplemental Symbols and Pictographs
        [0x2500, 0x257F], // Box Drawing
        [0x1F000, 0x1F02F], // Mahjong Tiles
        [0x2700, 0x27BF], // Dingbats
        [0x3000, 0x303F], // CJK Symbols and Punctuation
        [0xA700, 0xA71F], // Modifier Tone Letters
        [0xFF00, 0xFFEF]  // Halfwidth and Fullwidth Forms
    ];

    while (true) {
        const [start, end] = ranges[Math.floor(Math.random() * ranges.length)];
        const code = Math.floor(Math.random() * (end - start + 1)) + start;
        try {
            const char = String.fromCodePoint(code);
            // Ensure the character is printable and not a control character
            if (char && /\P{C}/u.test(char)) return char;
        } catch {
            // Catch errors from invalid code points, though unlikely with these ranges
        }
    }
}

type WordList = Map<string, {
    original: string; // The original casing/punctuation of the word
    list: string[];   // List of words that can follow this word
}>;

type NgramMap = Map<string, string[]>; // Maps an n-gram prefix (joined by '|') to possible next words

type WeightedStart = { words: [string, string]; weight: number };

export default class MarkovChains {
    public wordList: WordList;
    private trigramMap: NgramMap = new Map();
    private quadgramMap: NgramMap = new Map();
    private startTrigrams: WeightedStart[] = []; // Possible starting pairs of words and their weights

    constructor(wordList?: WordList) {
        this.wordList = wordList ?? new Map();
    }

    generateDictionary(texts: string[]): void {
        // Resets and rebuilds the dictionary and n-gram maps from input texts
        this.wordList = new Map();
        this.trigramMap = new Map();
        this.quadgramMap = new Map();
        this.startTrigrams = [];
        for (const key in TRIGRAM_FREQUENCY) { // Clear global frequency map
            delete TRIGRAM_FREQUENCY[key];
        }

        for (const text of texts) this.pickWords(text);

        // Sort startTrigrams to ensure deterministic behavior if Math.random() is seeded or for testing
        // Though, random selection from it later will still be random.
        this.startTrigrams.sort((a, b) => a.words.join("|").localeCompare(b.words.join("|")));


        // Optional: Export the learned Markov chain to a DOT file for visualization
        // This requires a Node.js environment to run.
        // try {
        //     this.exportMarkovToDOT(this.wordList, "./markov_chain.dot");
        //     console.log("Markov chain DOT file exported to ./markov_chain.dot");
        // } catch (e) {
        //     console.warn("Could not export DOT file. Ensure you are in a Node.js environment and have 'fs' access.", e);
        // }
    }

    generateChain(max: number, chaos: number = 0.5): string {
        // Generates a text chain of up to 'max' words with a given 'chaos' level (0 to 1)
        if (this.startTrigrams.length === 0) {
            console.warn("Dictionary is empty or no start trigrams found. Generate a dictionary first.");
            return "";
        }

        // Select a starting pair of words based on their weighted frequency
        const totalWeight = this.startTrigrams.reduce((sum, item) => sum + item.weight, 0);
        let r = Math.random() * totalWeight;
        let [word1, word2]: [string, string] = ["", ""]; // Current context for next word prediction

        for (const item of this.startTrigrams) {
            r -= item.weight;
            if (r <= 0) {
                [word1, word2] = item.words;
                break;
            }
        }
        // Fallback if somehow no start trigram was selected (should not happen if startTrigrams is populated)
        if (!word1 && this.startTrigrams.length > 0) {
            [word1, word2] = this.startTrigrams[0].words;
        }


        const generatedWords = [word1, word2];
        const seenTrigrams = new Set<string>(); // Prevents local loops by tracking used trigrams in this chain

        for (let i = 2; i < max; i++) {
            let nextWord: string | undefined;

            // Introduce more varied "chaos" by sometimes picking from different n-gram levels
            const chaosRoll = Math.random();

            if (chaosRoll < chaos * 0.1) { // High chaos: Larger chance of completely random word
                const allPossibleOriginalWords = Array.from(this.wordList.values()).map(entry => entry.original);
                if (allPossibleOriginalWords.length > 0) {
                    nextWord = this.randomKey(allPossibleOriginalWords);
                }
            } else {
                // Otherwise, use n-grams to select the next word
                const currentWord1 = word1; // Effectively generatedWords[i-2]
                const currentWord2 = word2; // Effectively generatedWords[i-1]

                let nGramCandidates: string[] = [];

                // 1. Quadgrams (context of 3 words)
                if (i >= 3 && chaosRoll < chaos * 0.4) { // Med-high chaos can lean more into quadgrams sometimes
                    const prevWordForQuad = generatedWords[i - 3];
                    const quadKey = `${this.parseKey(prevWordForQuad)}|${this.parseKey(currentWord1)}|${this.parseKey(currentWord2)}`;
                    const quads = this.quadgramMap.get(quadKey) ?? [];
                    if (quads.length > 0) {
                        nGramCandidates.push(...quads);
                        if (Math.random() > chaos * 0.7) { // Even stronger weight for quadgrams at lower chaos
                            nGramCandidates.push(...quads);
                        }
                    }
                }

                // 2. Trigrams (context of 2 words)
                const triKey = `${this.parseKey(currentWord1)}|${this.parseKey(currentWord2)}`;
                const tris = this.trigramMap.get(triKey) ?? [];
                if (tris.length > 0) {
                    nGramCandidates.push(...tris);
                    if (Math.random() > chaos * 0.5) { // Slight weight for trigrams
                        nGramCandidates.push(...tris);
                    }
                }

                // 3. Bigrams (context of 1 word, from wordList)
                if (chaosRoll > chaos * 0.6) { // Lower chaos leans more towards simple bigrams
                    const biKey = this.parseKey(currentWord2);
                    const bis = this.wordList.get(biKey)?.list ?? [];
                    if (bis.length > 0) {
                        nGramCandidates.push(...bis);
                    }
                }

                if (nGramCandidates.length > 0) {
                    nextWord = this.selectCandidate(nGramCandidates, chaos);
                } else {
                    // Fallback: if no n-gram candidates found
                    const allPossibleOriginalWords = Array.from(this.wordList.values()).map(entry => entry.original);
                    if (allPossibleOriginalWords.length > 0) {
                        nextWord = this.randomKey(allPossibleOriginalWords);
                    } else {
                        break;
                    }
                }
            }

            if (!nextWord) break;

            const trigramKey = `${this.parseKey(word1)}|${this.parseKey(word2)}|${this.parseKey(nextWord)}`;
            if (seenTrigrams.has(trigramKey)) {
                i--;
                continue;
            }
            seenTrigrams.add(trigramKey);

            generatedWords.push(nextWord);

            // More chaotic word combining at higher chaos
            const combineProbability = chaos * 0.25; // Increased base probability
            if (generatedWords.length > 2 && Math.random() < combineProbability) {
                const combineRoll = Math.random();
                if (chaos >= 0.7) {
                    // Higher chaos: prioritize combining with the immediately preceding word
                    if (combineRoll < 0.7) {
                        const lastIndex = generatedWords.length - 1;
                        generatedWords[lastIndex - 1] += nextWord;
                        generatedWords.splice(lastIndex, 1);
                    } else if (generatedWords.length > 3) {
                        const lastIndex = generatedWords.length - 1;
                        generatedWords[lastIndex - 2] += nextWord;
                        generatedWords.splice(lastIndex, 1);
                    }
                } else {
                    // Lower chaos: keep the previous logic
                    if (combineRoll < 0.5) {
                        const lastIndex = generatedWords.length - 1;
                        generatedWords[lastIndex - 1] += nextWord;
                        generatedWords.splice(lastIndex, 1);
                    } else if (generatedWords.length > 3) {
                        const lastIndex = generatedWords.length - 1;
                        generatedWords[lastIndex - 2] += nextWord;
                        generatedWords.splice(lastIndex, 1);
                    }
                }
                // Skip stutter after combining
            } else {
                // Reduced stutter chance that further decreases with higher chaos
                const stutterProbability = Math.max(0, 0.03 - (chaos * 0.02));
                if (Math.random() < stutterProbability) {
                    generatedWords.push(nextWord);
                }
            }

            if (this.isTerminalWord(nextWord) && i >= Math.floor(max * 0.6)) { // Slightly earlier terminal word possibility
                break;
            }

            word1 = word2;
            word2 = nextWord;
        }

        let finalText = this.filterGeneratedText(generatedWords.join(" "));

        const symbolCount = Math.floor(Math.random() * chaos * 5); // Increased symbol count at higher chaos
        for (let k = 0; k < symbolCount; k++) {
            const insertIndex = Math.floor(Math.random() * (finalText.length + 1));
            finalText = finalText.slice(0, insertIndex) + getRandomUnicodeSymbol() + finalText.slice(insertIndex);
        }

        return finalText;
    }

    private pickWords(text: string): void {
        const words = text.trim().split(/\s+/g);
        if (words.length < 2) return;

        const firstTrigramKey = `${this.parseKey(words[0])}|${this.parseKey(words[1])}`;
        TRIGRAM_FREQUENCY[firstTrigramKey] = (TRIGRAM_FREQUENCY[firstTrigramKey] ?? 0) + 1;
        const weight = 1 / TRIGRAM_FREQUENCY[firstTrigramKey];

        const existingStartTrigram = this.startTrigrams.find(st => st.words[0] === words[0] && st.words[1] === words[1]);
        if (existingStartTrigram) {
            existingStartTrigram.weight = weight;
        } else {
            this.startTrigrams.push({ words: [words[0], words[1]], weight });
        }


        for (let i = 0; i < words.length; i++) {
            const currentWord = words[i];
            const nextWord = words[i + 1];
            const key = this.parseKey(currentWord);

            if (!key) continue;

            if (!this.wordList.has(key)) {
                this.wordList.set(key, {
                    original: currentWord,
                    list: []
                });
            }

            if (nextWord) {
                const entry = this.wordList.get(key)!;
                if (entry.list.length < MAX_NEXT_WORDS) {
                    entry.list.push(nextWord);
                }
            }

            if (i + 2 < words.length) {
                const w1_key = this.parseKey(words[i]);
                const w2_key = this.parseKey(words[i + 1]);
                const w3_original = words[i + 2];

                if (!w1_key || !w2_key) continue;

                const trigramPrefixKey = `${w1_key}|${w2_key}`;
                if (!this.trigramMap.has(trigramPrefixKey)) {
                    this.trigramMap.set(trigramPrefixKey, []);
                }
                this.trigramMap.get(trigramPrefixKey)!.push(w3_original);
            }

            if (i + 3 < words.length) {
                const w0_key = this.parseKey(words[i]);
                const w1_key = this.parseKey(words[i + 1]);
                const w2_key = this.parseKey(words[i + 2]);
                const w3_original = words[i + 3];

                if (!w0_key || !w1_key || !w2_key) continue;

                const quadgramPrefixKey = `${w0_key}|${w1_key}|${w2_key}`;
                if (!this.quadgramMap.has(quadgramPrefixKey)) {
                    this.quadgramMap.set(quadgramPrefixKey, []);
                }
                this.quadgramMap.get(quadgramPrefixKey)!.push(w3_original);
            }
        }
    }

    private parseKey(word: string | undefined): string {
        if (!word) return "";
        // Include underscore in the word characters to handle things like "well_" if present in training data
        return /\w|_/.test(word)
            ? word.replace(/[<>()[\]{}:;.,!?`"']/g, "").toLowerCase() // Removed *, added `
            : word;
    }

    private selectCandidate(candidates: string[], chaos: number): string | undefined {
        if (candidates.length === 0) return undefined;

        // Slightly increased chance for completely random candidate from the pool
        if (Math.random() < chaos * 0.5) {
            return this.randomKey(candidates);
        }

        const weights = candidates.map(word => {
            const parsedWord = this.parseKey(word);
            if (COMMON_WORDS.has(parsedWord)) return 0.4; // Slightly less penalized
            if (PUNCTUATION_MARKS.has(word)) return 0.7; // Give a bit more weight to punctuation to maintain flow
            return 1;
        });

        const totalWeight = weights.reduce((a, b) => a + b, 0);

        if (totalWeight === 0) {
            return this.randomKey(candidates);
        }

        let r = Math.random() * totalWeight;
        let acc = 0;
        for (let i = 0; i < candidates.length; i++) {
            acc += weights[i];
            if (r <= acc) {
                return candidates[i];
            }
        }

        return candidates[candidates.length - 1];
    }

    private filterGeneratedText(text: string): string {
        text = text.trim();

        [["(", ")"], ["[", "]"], ["{", "}"]].forEach(pair => {
            text = this.removeUnclosedPairs(text, pair as [string, string]);
        });

        ['"', "'", "`", "*"].forEach(char => {
            text = this.removeUnclosedQuotes(text, char);
        });

        // Basic attempt to ensure a sentence ends if it should
        if (text.length > 50 && !/[.!?]$/.test(text)) {
            const lastSpaceIndex = text.lastIndexOf(" ");
            if (lastSpaceIndex > -1 && lastSpaceIndex > text.length - 20) {
                text = text.substring(0, lastSpaceIndex + 1) + this.randomKey(Array.from(PUNCTUATION_MARKS));
            }
        }

        return text.replace(/^[\.,;!? ]+/g, "").replace(/[\.,;!? ]+$/g, "");
    }

    private removeUnclosedQuotes(text: string, char: string): string {
        let count = 0;
        let lastIndex: number | undefined;

        for (let i = 0; i < text.length; i++) {
            if (text[i] === char) {
                lastIndex = i;
                count++;
            }
        }

        if (count % 2 !== 0 && lastIndex !== undefined) {
            text = text.slice(0, lastIndex) + text.slice(lastIndex + 1);
        }
        return text;
    }

    private removeUnclosedPairs(text: string, [open, close]: [string, string]): string {
        let balance = 0;
        for (let i = 0; i < text.length; i++) {
            if (text[i] === open) balance++;
            else if (text[i] === close) balance--;

            if (balance < 0) {
                return this.removeUnclosedPairs(text.slice(0, i) + text.slice(i + 1), [open, close]);
            }
        }
        if (balance > 0) {
            for (let i = 0; i < text.length; i++) {
                if (text[i] === open) {
                    return this.removeUnclosedPairs(text.slice(0, i) + text.slice(i + 1), [open, close]);
                }
            }
        }
        return text;
    }

    private exportMarkovToDOT(wordList: WordList, outputPath: string): void {
        let dot = `digraph MarkovChain {\n    rankdir=LR;\n    node [shape=box, fontsize=10];\n    edge [fontsize=9];\n`;

        for (const [_key, { original, list }] of wordList.entries()) {
            const counts = new Map<string, number>();
            for (const next of list) {
                counts.set(next, (counts.get(next) ?? 0) + 1);
            }

            for (const [next, count] of counts.entries()) {
                const fromNode = original.replace(/"/g, '\\"');
                const toNode = next.replace(/"/g, '\\"');
                dot += `    "${fromNode}" -> "${toNode}" [label="${count}"];\n`;
            }
        }
        dot += "}\n";
        fsWriteFileSync(outputPath, dot);
    }

    private randomKey<T>(array: T[]): T {
        return array[Math.floor(Math.random() * array.length)];
    }

    private isTerminalWord(word: string): boolean {
        return /[.!?]$/.test(word);
    }
}

// Example of String.prototype.deleteAt if not available globally:
/*
if (!String.prototype.deleteAt) {
    String.prototype.deleteAt = function(index: number) {
        if (index < 0 || index >= this.length) {
            return this.toString(); // Return original string if index is out of bounds
        }
        return this.slice(0, index) + this.slice(index + 1);
    };
}
*/
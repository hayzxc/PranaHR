import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook for typewriter effect with cycling words
 * @param {string[]} words - Array of words to cycle through
 * @param {number} typingSpeed - Speed of typing in ms (default: 100)
 * @param {number} deletingSpeed - Speed of deleting in ms (default: 50)
 * @param {number} pauseDuration - Pause before deleting in ms (default: 1500)
 * @returns {{ typedText: string, showCursor: boolean }}
 */
export const useTypewriter = (
    words,
    typingSpeed = 100,
    deletingSpeed = 50,
    pauseDuration = 1500
) => {
    const [typedText, setTypedText] = useState('');
    const [showCursor, setShowCursor] = useState(true);
    const [wordIndex, setWordIndex] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);

    // Use ref to avoid words array causing infinite re-renders
    const wordsRef = useRef(words);
    wordsRef.current = words;

    // Typewriter effect
    useEffect(() => {
        const currentWord = wordsRef.current[wordIndex];

        const timeout = setTimeout(() => {
            if (!isDeleting) {
                if (typedText.length < currentWord.length) {
                    setTypedText(currentWord.slice(0, typedText.length + 1));
                } else {
                    setTimeout(() => setIsDeleting(true), pauseDuration);
                }
            } else {
                if (typedText.length > 0) {
                    setTypedText(typedText.slice(0, -1));
                } else {
                    setIsDeleting(false);
                    setWordIndex((prev) => (prev + 1) % wordsRef.current.length);
                }
            }
        }, isDeleting ? deletingSpeed : typingSpeed);

        return () => clearTimeout(timeout);
    }, [typedText, isDeleting, wordIndex, typingSpeed, deletingSpeed, pauseDuration]);

    // Blinking cursor effect
    useEffect(() => {
        const cursorInterval = setInterval(() => {
            setShowCursor((prev) => !prev);
        }, 500);
        return () => clearInterval(cursorInterval);
    }, []);

    return { typedText, showCursor };
};

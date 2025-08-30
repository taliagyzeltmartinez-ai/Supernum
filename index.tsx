/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Fix: Add type definitions for the non-standard SpeechRecognition API to resolve TypeScript errors.
interface SpeechRecognition {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onend: (() => void) | null;
    onerror: ((event: any) => void) | null;
    onresult: ((event: any) => void) | null;
    start(): void;
    stop(): void;
}

interface SpeechRecognitionStatic {
    new(): SpeechRecognition;
}

declare global {
    interface Window {
        SpeechRecognition: SpeechRecognitionStatic;
        webkitSpeechRecognition: SpeechRecognitionStatic;
    }
}

import { GoogleGenAI, Chat } from '@google/genai';
import { marked } from 'marked';

const chatContainer = document.getElementById('chat-container');
const chatHistory = document.getElementById('chat-history');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input') as HTMLInputElement;
const sendButton = chatForm.querySelector('button[type="submit"]');
const attachFileBtn = document.getElementById('attach-file-btn');
const cameraBtn = document.getElementById('camera-btn');
const micBtn = document.getElementById('mic-btn');
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const previewContainer = document.getElementById('preview-container');
const previewImage = document.getElementById('preview-image') as HTMLImageElement;
const removeImageBtn = document.getElementById('remove-image-btn');
const permissionModal = document.getElementById('permission-modal');
const activatePermissionsBtn = document.getElementById('activate-permissions-btn');
const laterPermissionsBtn = document.getElementById('later-permissions-btn');

// Camera Modal Elements
const cameraModal = document.getElementById('camera-modal');
const cameraView = document.getElementById('camera-view') as HTMLVideoElement;
const captureBtn = document.getElementById('capture-btn');
const cancelCameraBtn = document.getElementById('cancel-camera-btn');
let cameraStream: MediaStream | null = null;


const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    displayMessage("Error: La clave de API no está configurada. Por favor, asegúrate de que esté configurada en las variables de entorno.", "model");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const systemInstruction = `
Eres 'Mi Tutor Amigo AI', llamado "SuperNum", un asistente educativo diseñado para ayudar a estudiantes de Segundo y tercer ciclo de Educación Básica en El Salvador (grados 5º a 9º), especialmente a aquellos con necesidades educativas especiales como deficit de atención e hiperactividad, autismo, lento aprendizaje o que necesiten un apoyo extra; en la asignatura de Matemática.

Tu objetivo principal es simplificar conceptos, ofrecer explicaciones claras y concisas, y proporcionar el paso a paso en ejercicios o problemas a solucionar, para facilitar la comprensión de los temas.

**Fuente de conocimiento principal (Matemáticas):** Tu base de conocimiento principal son los libros de texto del proyecto ESMATE de El Salvador. Debes emular el estilo, la terminología y los métodos de resolución presentados en estos libros. Por ejemplo, utiliza la estructura de Problema (P), Solución (S), Conclusión (C) y Ejemplo (E) cuando sea apropiado.
- Para estudiantes de **9º grado**, utiliza el "Libro de texto de Matemática de 9º grado".
- Para estudiantes de **8º grado**, utiliza el "Libro de texto de Matemática de 8º grado".
- Para estudiantes de **7º grado**, utiliza el "Libro de texto de Matemática de 7º grado".
- Para estudiantes de **6º grado**, utiliza el "Libro de texto de Matemática de 6º grado".
- Para estudiantes de **5º grado**, utiliza el "Libro de texto de Matemática de 5º grado".
- Para otros grados, basa tus explicaciones en el currículo oficial de El Salvador y el estilo general de sus materiales educativos.

**Recursos de Video (Regla Estricta):**
- Cuando un estudiante pida un video o consideres que un video sería útil para explicar un tema, DEBES usar únicamente los enlaces de la página oficial de matemática: https://sites.google.com/clases.edu.sv/matematica-pradera/p%C3%A1gina-principal.
- Busca el video apropiado para el grado del estudiante en las siguientes secciones:
  - **Sexto Grado:** https://sites.google.com/clases.edu.sv/matematica-pradera/sexto-grado
  - **Séptimo Grado:** https://sites.google.com/clases.edu.sv/matematica-pradera/s%C3%A9ptimo-grado
  - **Octavo Grado:** https://sites.google.com/clases.edu.sv/matematica-pradera/octavo-grado
  - **Noveno Grado:** https://sites.google.com/clases.edu.sv/matematica-pradera/noveno-grado
- NO debes inventar ni proporcionar enlaces de video de ninguna otra fuente (como YouTube, Khan Academy, etc.). Si no encuentras un video relevante en los sitios proporcionados, informa amablemente al estudiante que no tienes un video sobre ese tema específico en la fuente oficial.

**Capacidad de Generación de Imágenes:**
- Cuando vayas a explicar un concepto que se pueda visualizar (como fracciones, figuras geométricas, etc.), puedes ofrecer generar una imagen para ayudar. Pregunta primero, por ejemplo: "¿Quieres que genere una imagen para ayudarte a visualizar esto?".
- Si el usuario acepta, debes incluir en tu respuesta una etiqueta especial para que yo pueda crear la imagen. La etiqueta debe ser: \`[GENERATE_IMAGE: prompt en inglés para la imagen]\`
- **IMPORTANTE:** El texto dentro de la etiqueta (el "prompt") DEBE estar en inglés y ser descriptivo y sencillo para un modelo de IA.
- Puedes añadir texto normal antes o después de la etiqueta.
- Ejemplo de respuesta si el usuario quiere una imagen de "un medio": "¡Excelente idea! Aquí tienes una imagen que lo representa. [GENERATE_IMAGE: A simple pie chart showing 1 of 2 equal parts colored in, representing the fraction 1/2.] ¿Ves cómo la parte coloreada es la mitad del círculo?"

**Capacidad de Análisis de Imágenes:**
- Ahora también puedes recibir imágenes. Si un estudiante te envía una imagen de un ejercicio matemático, tu tarea es analizarla, comprender el problema y proporcionar una solución paso a paso de manera clara y concisa.
- Asegúrate de explicar el razonamiento detrás de cada paso. Tu objetivo es que el estudiante entienda CÓMO resolver el problema, no solo darle la respuesta.

**Flujo de la conversación:**
1.  **El primer mensaje del usuario será su grado.** La interfaz ya le habrá preguntado. Identifica el grado (de 5º a 9º) y confirma que lo has entendido antes de continuar. Por ejemplo: "¡Excelente, 7º grado! Estoy listo para ayudarte con los temas de tu libro. ¿Cuál es tu pregunta?".
2.  **Si el usuario no indica su grado o pregunta otra cosa primero, insiste amablemente.** Por ejemplo: "Para poder darte la mejor explicación, primero necesito saber en qué grado estás. ¿Me dices si es quinto, sexto, séptimo, octavo o noveno?".
3.  **Una vez confirmado el grado, procede a ayudar con la pregunta** siguiendo las demás reglas.

Reglas estrictas a seguir:
1.  **Sé siempre paciente, amable, alentador y positivo.** Tu tono debe ser siempre amigable y de apoyo.
2.  **Usa un lenguaje cercano y accesible.** Imagina que hablas con un niño de 10 años. Evita la jerga compleja. **Responde siempre en español de El Salvador.**
3.  **Prioriza respuestas cortas y directas.** Da la información necesaria de forma clara y fácil de entender. Solo amplía la información o da más detalles si el estudiante lo pide explícitamente.
4.  **Explica los conceptos de la manera más sencilla posible.** Usa analogías y ejemplos de la vida real si es posible, siempre alineados con el enfoque del libro de texto.
5.  **Siempre ofrece el paso a paso en la resolución de los ejemplos.** Numera los pasos claramente, tal como lo haría el libro de texto.
6.  **Después de una explicación, interactúa con el estudiante.** Pregunta siempre algo como: "¿Me he explicado bien?", "¿Quieres que probemos con otro ejemplo?", o "¿Tienes alguna otra pregunta sobre esto?".
7.  **Si un estudiante dice que no entiende, reformula la explicación.** Usa una estrategia diferente. Ofrece opciones como: "¿Prefieres que te lo explique con más detalle?" o "¿Quieres que use menos palabras y lo explique de una manera más fácil?".
8.  **Anima al estudiante a preguntar.** Hazle saber que no hay preguntas tontas y que estás aquí para ayudar.
9.  **Mantente enfocado en tu área de conocimiento.** Tu área de conocimiento es Matemáticas para los grados especificados. Si te preguntan algo fuera de este tema, responde amablemente: "Mi función es ayudarte con tus estudios de matemática. ¡Con mucho gusto te ayudo si tienes alguna pregunta sobre ese tema!".
`;

let chat: Chat;
let attachedFile: File | null = null;
let recognition: SpeechRecognition | null = null;
let isListening = false;
let speechVoice: SpeechSynthesisVoice | null = null;

// Compatibility check for SpeechRecognition API
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function loadVoices() {
    window.speechSynthesis.onvoiceschanged = () => {
        const voices = window.speechSynthesis.getVoices();
        speechVoice = voices.find(voice => voice.lang === 'es-ES') ||
                      voices.find(voice => voice.lang === 'es-US') ||
                      voices.find(voice => voice.lang === 'es-MX') ||
                      voices.find(voice => voice.lang.startsWith('es-')) ||
                      null;
    };
    if (window.speechSynthesis.getVoices().length > 0) {
       (window.speechSynthesis.onvoiceschanged as EventListener)(new Event('voiceschanged'));
    }
}

function speak(text: string) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        if (speechVoice) {
            utterance.voice = speechVoice;
        }
        utterance.lang = speechVoice?.lang || 'es-ES';
        window.speechSynthesis.speak(utterance);
    } else {
        console.error("La síntesis de voz no es compatible con este navegador.");
        alert("Lo siento, tu navegador no soporta la función de lectura en voz alta.");
    }
}

async function toBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });
}

async function fileToGenerativePart(file: File) {
    const base64EncodedData = await toBase64(file);
    return {
        inlineData: {
            data: base64EncodedData,
            mimeType: file.type
        }
    };
}

async function requestAndHandlePermissions() {
    try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            stream.getTracks().forEach(track => track.stop());
            console.log("Permisos de cámara y micrófono concedidos.");
        } else {
             console.log("getUserMedia no es compatible con este navegador.");
        }
    } catch (error) {
        console.error("Error al solicitar permisos:", error);
        (cameraBtn as HTMLButtonElement).disabled = true;
        (cameraBtn as HTMLButtonElement).title = "El permiso para usar la cámara fue denegado.";
        if (micBtn) {
           (micBtn as HTMLButtonElement).disabled = true;
           (micBtn as HTMLButtonElement).title = "El permiso para usar el micrófono fue denegado.";
        }
    } finally {
        permissionModal.classList.add('hidden');
        localStorage.setItem('permissionRequested', 'true');
    }
}

function setupPermissionModal() {
    if (!localStorage.getItem('permissionRequested')) {
        permissionModal.classList.remove('hidden');
    }

    activatePermissionsBtn.addEventListener('click', requestAndHandlePermissions);

    laterPermissionsBtn.addEventListener('click', () => {
        permissionModal.classList.add('hidden');
        localStorage.setItem('permissionRequested', 'true');
    });
}

function setupVoiceRecognition() {
    if (!micBtn) return;

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.lang = 'es-SV'; // Spanish (El Salvador)
        recognition.interimResults = true;

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            chatInput.value = finalTranscript + interimTranscript;
        };

        recognition.onend = () => {
            isListening = false;
            micBtn.classList.remove('listening');
        };
        
        recognition.onerror = (event) => {
            console.error('Error en el reconocimiento de voz:', event.error);
            isListening = false;
            micBtn.classList.remove('listening');
        };

    } else {
        console.warn("El reconocimiento de voz no es compatible con este navegador.");
        (micBtn as HTMLButtonElement).disabled = true;
        (micBtn as HTMLButtonElement).title = "El reconocimiento de voz no es compatible con este navegador.";
    }

    micBtn.addEventListener('click', () => {
        if (!recognition) return;

        if (isListening) {
            recognition.stop();
        } else {
            try {
                recognition.start();
                isListening = true;
                micBtn.classList.add('listening');
            } catch(e) {
                console.error("No se pudo iniciar el reconocimiento de voz:", e);
                isListening = false;
                micBtn.classList.remove('listening');
            }
        }
    });
}


async function initializeChat() {
    loadVoices();
    setupPermissionModal();
    setupVoiceRecognition();
    setupCameraModal();
    try {
        chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: systemInstruction,
            },
        });
        const welcomeMessage = "¡Hola! Soy Tu Tutor Amigo AI, llamado SuperNum y estoy listo para ayudarte con tus preguntas de matemática. 🤓 Para poder ayudarte mejor, por favor dime: ¿A qué grado perteneces? (Quinto, Sexto, Séptimo, Octavo o Noveno)?";
        displayMessage(welcomeMessage, 'model');
    } catch (error) {
        console.error("Error al inicializar el chat:", error);
        displayMessage("¡Uy! No pude iniciar nuestra conversación. Por favor, revisa la configuración y recarga la página.", 'model');
    }
}

function scrollToBottom() {
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

async function displayMessage(message: string, sender: 'user' | 'model' | 'thinking', imageUrl?: string) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', `${sender}-message`);

    if (sender === 'thinking') {
        messageElement.innerHTML = message;
        messageElement.id = 'thinking-message';
    } else if (sender === 'user') {
        if (imageUrl) {
            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = "Imagen enviada por el usuario";
            messageElement.appendChild(img);
        }
        if (message) {
            const textPart = document.createElement('div');
            textPart.innerHTML = await marked.parse(message);
            messageElement.appendChild(textPart);
        }
    } else { // sender === 'model'
        const textContentElement = document.createElement('div');
        textContentElement.classList.add('model-text-content');
        if (message) {
             textContentElement.innerHTML = await marked.parse(message);
        }
        messageElement.appendChild(textContentElement);
    }

    chatHistory.appendChild(messageElement);
    scrollToBottom();
    return messageElement;
}


async function handleStream(responseStream: AsyncGenerator<any, any, any>, modelMessageElement: HTMLElement): Promise<string> {
    const textContentElement = modelMessageElement.querySelector('.model-text-content');
    if (!textContentElement) return '';

    let fullResponse = '';
    for await (const chunk of responseStream) {
        fullResponse += chunk.text;
        const textToShow = fullResponse.replace(/\[GENERATE_IMAGE:.*?\]/g, '').trim();
        textContentElement.innerHTML = await marked.parse(textToShow);
        scrollToBottom();
    }
    return fullResponse;
}

async function generateImage(prompt: string): Promise<string> {
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: `simple, clear, educational illustration for a child, math concept: ${prompt}. Clean background, vibrant colors.`,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '1:1',
            },
        });
        const base64ImageBytes = response.generatedImages[0].image.imageBytes;
        return `data:image/jpeg;base64,${base64ImageBytes}`;
    } catch (error) {
        console.error("Error generating image:", error);
        return '';
    }
}

async function processResponseForImages(fullResponse: string, messageElement: HTMLElement) {
    const imageMatch = fullResponse.match(/\[GENERATE_IMAGE:(.*?)\]/);
    if (imageMatch && imageMatch[1]) {
        const imagePrompt = imageMatch[1].trim();
        const imageContainer = document.createElement('div');
        imageContainer.classList.add('image-container');
        imageContainer.innerHTML = `<p class="image-loading">Generando una ayuda visual...</p>`;
        messageElement.appendChild(imageContainer);
        scrollToBottom();

        const imageUrl = await generateImage(imagePrompt);
        if (imageUrl) {
            imageContainer.innerHTML = `<img src="${imageUrl}" alt="Ayuda visual para: ${imagePrompt}" />`;
        } else {
            imageContainer.innerHTML = `<p class="image-error">Lo siento, no pude crear la imagen esta vez.</p>`;
        }
        scrollToBottom();
    }
}

function handleFileSelect(file: File | null) {
    if (!file || !file.type.startsWith('image/')) {
        if (file) alert('Por favor, selecciona solo archivos de imagen.');
        attachedFile = null;
        return;
    }
    attachedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImage.src = e.target.result as string;
        previewContainer.classList.remove('hidden');
        chatInput.placeholder = "Añade un comentario a tu imagen...";
    };
    reader.readAsDataURL(file);
}

function removeAttachedFile() {
    attachedFile = null;
    fileInput.value = '';
    previewContainer.classList.add('hidden');
    previewImage.src = '';
    chatInput.placeholder = "Escribe tu respuesta o pregunta aquí...";
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    cameraModal.classList.add('hidden');
}

function setupCameraModal() {
    cameraBtn.addEventListener('click', async () => {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                cameraView.srcObject = cameraStream;
                cameraModal.classList.remove('hidden');
            } catch (err) {
                console.error("Error al acceder a la cámara:", err);
                alert("No se pudo acceder a la cámara. Asegúrate de haber concedido los permisos.");
            }
        }
    });

    captureBtn.addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = cameraView.videoWidth;
        canvas.height = cameraView.videoHeight;
        const context = canvas.getContext('2d');
        context.drawImage(cameraView, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob(blob => {
            if (blob) {
                const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
                handleFileSelect(file);
            }
            stopCamera();
        }, 'image/jpeg');
    });

    cancelCameraBtn.addEventListener('click', stopCamera);
}

attachFileBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => handleFileSelect(fileInput.files ? fileInput.files[0] : null));
removeImageBtn.addEventListener('click', removeAttachedFile);

chatContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    chatContainer.classList.add('drag-over');
});
chatContainer.addEventListener('dragleave', () => {
    chatContainer.classList.remove('drag-over');
});
chatContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    chatContainer.classList.remove('drag-over');
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files[0]);
        e.dataTransfer.clearData();
    }
});

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userInput = chatInput.value.trim();

    if ((!userInput && !attachedFile) || !chat) return;
    
    if (isListening) {
        recognition?.stop();
    }

    chatInput.value = '';
    chatInput.disabled = true;
    (sendButton as HTMLButtonElement).disabled = true;
    (attachFileBtn as HTMLButtonElement).disabled = true;
    (cameraBtn as HTMLButtonElement).disabled = true;
    (micBtn as HTMLButtonElement).disabled = true;


    const currentFile = attachedFile;
    const fileUrl = currentFile ? URL.createObjectURL(currentFile) : undefined;
    
    await displayMessage(userInput, 'user', fileUrl);
    removeAttachedFile();
    
    const thinkingMessage = await displayMessage("SuperNum está pensando...", 'thinking');
    
    try {
        const messageParts = [];

        if (currentFile) {
            messageParts.push(await fileToGenerativePart(currentFile));
        }
        if (userInput) {
            messageParts.push({ text: userInput });
        }
        
        const responseStream = await chat.sendMessageStream({ message: messageParts });

        if (thinkingMessage.parentNode) {
            chatHistory.removeChild(thinkingMessage);
        }
        const modelMessageElement = await displayMessage('', 'model');
        const fullResponseText = await handleStream(responseStream, modelMessageElement);
        await processResponseForImages(fullResponseText, modelMessageElement);
        
        const textToSpeak = fullResponseText.replace(/\[GENERATE_IMAGE:.*?\]/g, '').trim();
        if (textToSpeak) {
            const speakerTemplate = document.getElementById('speaker-btn-template') as HTMLTemplateElement;
            if (speakerTemplate) {
                const speakerBtnFragment = speakerTemplate.content.cloneNode(true);
                const speakerBtn = (speakerBtnFragment as HTMLElement).querySelector('.speaker-btn');
                if (speakerBtn) {
                    speakerBtn.addEventListener('click', () => {
                        speak(textToSpeak);
                    });
                    modelMessageElement.appendChild(speakerBtnFragment);
                }
            }
        }

    } catch (error) {
        console.error("Error al enviar el mensaje:", error);
        if (thinkingMessage.parentNode) {
            chatHistory.removeChild(thinkingMessage);
        }
        await displayMessage("¡Vaya! Algo salió mal y no pude procesar tu pregunta. ¿Podrías intentar preguntarme de otra manera?", 'model');
    } finally {
        chatInput.disabled = false;
        (sendButton as HTMLButtonElement).disabled = false;
        (attachFileBtn as HTMLButtonElement).disabled = false;
        (cameraBtn as HTMLButtonElement).disabled = false;
        (micBtn as HTMLButtonElement).disabled = false;
        chatInput.focus();
        if (fileUrl) {
            URL.revokeObjectURL(fileUrl);
        }
    }
});

initializeChat();
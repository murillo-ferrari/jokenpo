const encodedConfig = "@@FIREBASE_CONFIG@@";

const decodeFirebaseConfig = (encodedValue) => {
  if (!encodedValue || encodedValue.includes("@@")) {
    throw new Error(
      "Firebase config is missing. Ensure the deployment step injects the config or provide `window.__LOCAL_FIREBASE_CONFIG__` for local use."
    );
  }

  try {
    return JSON.parse(atob(encodedValue));
  } catch (error) {
    console.error("Failed to decode Firebase config", error);
    throw error;
  }
};

const localConfig =
  typeof window !== "undefined" ? window.__LOCAL_FIREBASE_CONFIG__ : undefined;

const firebaseConfig = localConfig || decodeFirebaseConfig(encodedConfig);

firebase.initializeApp(firebaseConfig);

export const database = firebase.database();
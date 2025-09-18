// Saves data to local storage
export const saveToLocalStorage = <T,>(key: string, value: T) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(error);
  }
};

// Gets data from local storage
export const getFromLocalStorage = <T,>(key: string): T | null => {
  try {
    const value = localStorage.getItem(key);
    if (value) {
      return JSON.parse(value) as T;
    }
    return null;
  } catch (error) {
    console.error(error);
    return null;
  }
};

import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Book } from '../types/book';

export const getBooks = async (): Promise<Book[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, 'books'));
    const books: Book[] = [];
    querySnapshot.forEach((doc) => {
      books.push(doc.data() as Book);
    });
    
    // Sort by book_id to maintain order TLX-001, TLX-002, etc.
    return books.sort((a, b) => a.book_id.localeCompare(b.book_id));
  } catch (error) {
    console.error('Error fetching books:', error);
    throw new Error('Failed to fetch books from Firestore');
  }
};

export const getBookById = async (bookId: string): Promise<Book | null> => {
  try {
    const docRef = doc(db, 'books', bookId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as Book;
    } else {
      return null;
    }
  } catch (error) {
    console.error(`Error fetching book ${bookId}:`, error);
    throw new Error(`Failed to fetch book ${bookId}`);
  }
};

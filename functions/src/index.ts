import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const COLLECTION_CELEBS = "celebs";
const COLLECTION_PROGRAMS = "programs";
const COLLECTION_RESTAURANTS = "restaurants";
const COLLECTION_REVIEWS = "reviews";
const COLLECTION_FAVORITES = "favorites";
const COLLECTION_TOKENS = "tokens";

const MESSAGE_TYPE_REVIEW_CREATED = "review_created";

admin.initializeApp();

exports.onCelebCreated = functions.firestore
  .document(`${COLLECTION_CELEBS}/{celebId}`)
  .onCreate((snapshot, context) => {
    const data = snapshot.data();
    if (data) {
      data.indices = generateIndices(data.name);
      return snapshot.ref.update(data);
    }
    return null;
  });

exports.onProgramCreated = functions.firestore
  .document(`${COLLECTION_PROGRAMS}/{programId}`)
  .onCreate((snapshot, context) => {
    const data = snapshot.data();
    if (data) {
      data.indices = generateIndices(data.name);
      return snapshot.ref.update(data);
    }
    return null;
  });

exports.onRestaurantCreated = functions.firestore
  .document(`${COLLECTION_RESTAURANTS}/{restaurantId}`)
  .onCreate((snapshot, context) => {
    const data = snapshot.data();
    if (data) {
      // data.objectId = context.params.restaurantId;
      data.indices = generateIndices(data.name);
      return snapshot.ref.update(data);
    }
    return null;
  });

exports.onReviewCreated = functions.firestore
  .document(`${COLLECTION_REVIEWS}/{reviewId}`)
  .onCreate(async (snapshot, context) => {
    console.info(`onReviewCreated: New review id (${context.params.reviewId})`);
    const reviewData = snapshot.data();
    if (reviewData) {
      const notifyRestaurantId = reviewData.restaurantId;

      const favorites = await admin
        .firestore()
        .collection(COLLECTION_FAVORITES)
        .get();

      const notifyIds: string[] = favorites.docs
        .filter(doc => {
          const data = doc.data();
          return data && data.restaurantId == notifyRestaurantId;
        })
        .map(doc => {
          const data = doc.data();
          return data.userId;
        });

      const tokens = await admin
        .firestore()
        .collection(COLLECTION_TOKENS)
        .get();

      const notifyTokens: string[] = tokens.docs
        .filter(doc => {
          const data = doc.data();
          return data && notifyIds.includes(data.uid);
        })
        .map(doc => {
          return doc.id;
        });

      if (notifyTokens.length > 0) {
        const message = {
          data: {
            type: MESSAGE_TYPE_REVIEW_CREATED,
            restaurantId: notifyRestaurantId
          },
          tokens: notifyTokens
        };

        console.info(
          `onReviewCreated: Notify tokens (length: ${notifyTokens.length})`
        );
        const response = await admin.messaging().sendMulticast(message);
        console.info(
          `onReviewCreated: Notify results (success: ${response.successCount}, failed: ${response.failureCount})`
        );
      } else {
        console.info(`onReviewCreated: Notify tokens is empty`);
      }
    }
  });

exports.analyzeRestaurants = functions.https.onRequest(
  async (request, response) => {
    const restaurants = await admin
      .firestore()
      .collection(COLLECTION_RESTAURANTS)
      .get();

    let output = "";
    const docs = restaurants.docs;
    for (let index = 0; index < docs.length; index++) {
      const doc = docs[index];
      const data = doc.data();
      if (data) {
        output += await validRestaurant(doc.id, data);
      }
    }

    response.send(output);
  }
);

async function validRestaurant(
  id: string,
  restaurant: FirebaseFirestore.DocumentData
): Promise<string> {
  console.info(`Analyze ${id}`);
  const image = restaurant.image;
  console.info(`image: ${image}`);
  const bucket = admin.storage().bucket();
  const isExist = await bucket.file(image).exists();
  console.info(`exists: ${isExist}`);
  return `${id}: ${image} = ${isExist}\n`;
}

exports.updateIndicesAll = functions.https.onRequest(
  async (request, response) => {
    await updateCollectionIndices(COLLECTION_CELEBS);
    await updateCollectionIndices(COLLECTION_PROGRAMS);
    await updateCollectionIndices(COLLECTION_RESTAURANTS);
    response.send("Request update collection indices");
  }
);

const updateCollectionIndices = async (collectionName: string) => {
  const firestore = admin.firestore();
  const documents = await firestore.collection(collectionName).listDocuments();
  documents.forEach(async document => {
    const snapshot = await document.get();
    const data = snapshot.data();
    if (data) {
      data.indices = generateIndices(data.name);
      await document.update(data);
    }
  });
};

const generateIndices = (name: String) => {
  const indices = [];
  for (let start = 0; start < name.length; start++) {
    for (let end = start + 1; end <= name.length; end++) {
      indices.push(name.substring(start, end));
    }
  }
  return indices;
};

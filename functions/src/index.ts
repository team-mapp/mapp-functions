import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const COLLECTION_CELEBS = "celebs";
const COLLECTION_PROGRAMS = "programs";
const COLLECTION_RESTAURANTS = "restaurants";
const COLLECTION_CELEBS_RELATIONS = "celebs_relations";
const COLLECTION_PROGRAMS_RELATIONS = "programs_relations";

admin.initializeApp();

exports.onCelebCreated = functions.firestore
  .document(`${COLLECTION_CELEBS}/{celebId}`)
  .onCreate((snapshot, context) => {
    const data = snapshot.data();
    if (data) {
      const dataId = context.params.celebId;

      // Update relations
      admin
        .firestore()
        .collection(COLLECTION_CELEBS_RELATIONS)
        .doc(dataId)
        .create({})
        .then(_ =>
          console.debug(`Update relations ${COLLECTION_CELEBS}/${dataId}`)
        )
        .catch(err =>
          console.error(
            `Can't update relations ${COLLECTION_CELEBS}/${dataId}`,
            err
          )
        );

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
      const dataId = context.params.programId;

      // Update relations
      admin
        .firestore()
        .collection(COLLECTION_PROGRAMS_RELATIONS)
        .doc(dataId)
        .create({})
        .then(_ =>
          console.debug(`Update relations ${COLLECTION_PROGRAMS}/${dataId}`)
        )
        .catch(err =>
          console.error(
            `Can't update relations ${COLLECTION_PROGRAMS}/${dataId}`,
            err
          )
        );

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

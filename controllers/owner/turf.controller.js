import { validationResult } from "express-validator";
import cloudinary from "../../utils/cloudinary.js";
import Turf from "../../models/turf.model.js";
import chalk from "chalk";
import Review from "../../models/review.model.js"

export const turfRegister = async (req, res) => {
  const image = req.file.path;
  const owner = req.owner.id;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array() });
  }
  try {
    // upload the turf image to cloudinary
    const turfImage = await cloudinary.uploader.upload(image, {
      folder: "TurfUp/turfs",
    });
    const turf = new Turf({
      image: turfImage.secure_url,
      owner,
      ...req.body,
    });
    await turf.save();
    return res
      .status(201)
      .json({ success: true, message: "Turf created successfully" });
  } catch (err) {
    console.error(chalk.red(err.message));
    return res.status(500).json({ success: false, message: err.message });
  }
};

// get all turfs by owner id

export const getTurfByOwner = async (req, res) => {
  const ownerId = req.owner.id;

  try {
    const turfs = await Turf.find({ owner: ownerId });

    // get all reviews by turf id of owner
    const turfsWithAvgRating = await Promise.all(
      turfs.map(async (turf) => {
        const reviewCount = turf.reviews.length;
        const avgRating =
          reviewCount > 0
            ? await Review.aggregate([
                { $match: { turf: turf._id } },
                { $group: { _id: null, avgRating: { $avg: "$rating" } } },
              ])
            : 0;
        return {
          ...turf.toObject(),
          avgRating: avgRating[0] ? avgRating[0].avgRating : 0,
        };
      })
    );
 
    return res.status(200).json(turfsWithAvgRating);
  } catch (err) {
    console.error("Error getting turfs by ownerId", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

//  edit turf by id

export const editTurfById = async (req, res) => {
  const owner = req.owner.id;

  const { id } = req.params;
  const ALLOWED = ["name", "description", "location", "pricePerHour", "openTime", "closeTime", "image"];
  const updatedTurfData = Object.fromEntries(
    ALLOWED.filter((k) => req.body[k] !== undefined).map((k) => [k, req.body[k]])
  );
  const sportTypes = [].concat(req.body.sportTypes ?? [], req.body.sportsType ?? []);
  if (sportTypes.length) updatedTurfData.sportTypes = sportTypes;

  try {
    const updatedTurf = await Turf.findOne({ owner: owner, _id: id });
    if (!updatedTurf) {
      return res
        .status(404)
        .json({ success: false, message: "Turf not found" });
    }

    await Turf.findOneAndUpdate({ owner: owner, _id: id }, updatedTurfData, {
      new: true,
    });
    const allTurfs = await Turf.find({ owner: owner });
    return res
      .status(200)
      .json({ success: true, message: "Turf updated successfully", allTurfs });
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};


// delete turf by id
export const deleteTurfById = async (req, res) => {
  const owner = req.owner.id;
  const { id } = req.params;

  try {
    const turf = await Turf.findOne({ owner: owner, _id: id });
    
    if (!turf) {
      return res.status(404).json({ 
        success: false, 
        message: "Turf not found" 
      });
    }

    // Delete from database
    await Turf.findOneAndDelete({ owner: owner, _id: id });

    // Get all remaining turfs for this owner
    const allTurfs = await Turf.find({ owner: owner });

    // Get updated turfs with average ratings
    const turfsWithAvgRating = await Promise.all(
      allTurfs.map(async (turf) => {
        const reviewCount = turf.reviews.length;
        const avgRating = reviewCount > 0
          ? await Review.aggregate([
              { $match: { turf: turf._id } },
              { $group: { _id: null, avgRating: { $avg: "$rating" } } },
            ])
          : 0;
        return {
          ...turf.toObject(),
          avgRating: avgRating[0] ? avgRating[0].avgRating : 0,
        };
      })
    );

    return res.status(200).json({ 
      success: true, 
      message: "Turf deleted successfully",
      allTurfs: turfsWithAvgRating 
    });

  } catch (err) {
    console.error(chalk.red("Error deleting turf:", err.message));
    return res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};
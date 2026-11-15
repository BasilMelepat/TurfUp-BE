import Turf from "../../models/turf.model.js";
import Review from "../../models/review.model.js";
import cloudinary from "../../utils/cloudinary.js";
import { validationResult } from "express-validator";
import chalk from "chalk";

// Get all turfs (existing function)
export const getAllTurfs = async (req, res) => {
  const admin = req.admin.role;
  if (admin !== "admin") {
    return res
      .status(403)
      .json({ success: false, message: "Unauthorized access denied" });
  }
  try {
    const turfs = await Turf.find().lean();

    // Calculate average rating for each turf
    const turfsWithAvgRating = await Promise.all(
      turfs.map(async (turf) => {
        const reviews = await Review.find({ turf: turf._id });
        const totalRating = reviews.reduce(
          (sum, review) => sum + review.rating,
          0
        );
        const avgRating = reviews.length > 0 ? totalRating / reviews.length : 0;
        return {
          ...turf,
          avgRating: Number(avgRating.toFixed(1)),
        };
      })
    );
    return res.status(200).json({
      turfs: turfsWithAvgRating,
    });
  } catch (error) {
    console.error("Error in getAllTurfs: ", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Register new turf as admin with owner assignment
export const adminTurfRegister = async (req, res) => {
  const admin = req.admin.role;
  if (admin !== "admin") {
    return res
      .status(403)
      .json({ success: false, message: "Unauthorized access denied" });
  }

  const image = req.file?.path;
  const { owner, ...turfDetails } = req.body; // Extract owner from request body
  
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array() });
  }

  // Validate that owner ID is provided
  if (!owner) {
    return res.status(400).json({ 
      success: false, 
      message: "Owner ID is required for turf registration" 
    });
  }

  try {
    let turfImage = {};
    if (image) {
      // Upload the turf image to cloudinary
      turfImage = await cloudinary.uploader.upload(image, {
        folder: "TurfUp/turfs",
      });
    }

    const turf = new Turf({
      ...(image && { image: turfImage.secure_url }),
      owner, // Assign the owner
      ...turfDetails
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

// Edit turf by id as admin
export const adminEditTurfById = async (req, res) => {
  const admin = req.admin.role;
  if (admin !== "admin") {
    return res
      .status(403)
      .json({ success: false, message: "Unauthorized access denied" });
  }

  const { id } = req.params;
  const ALLOWED = ["name", "description", "location", "pricePerHour", "openTime", "closeTime", "image"];
  const updatedTurfData = Object.fromEntries(
    ALLOWED.filter((k) => req.body[k] !== undefined).map((k) => [k, req.body[k]])
  );
  const sportTypes = [].concat(req.body.sportTypes ?? [], req.body.sportsType ?? []);
  if (sportTypes.length) updatedTurfData.sportTypes = sportTypes;
  if (req.body.owner) updatedTurfData.owner = req.body.owner;

  try {
    const updatedTurf = await Turf.findById(id);
    if (!updatedTurf) {
      return res
        .status(404)
        .json({ success: false, message: "Turf not found" });
    }

    await Turf.findByIdAndUpdate(id, updatedTurfData, { new: true });
    
    // Get updated list of all turfs with ratings
    const allTurfs = await Turf.find().lean();
    const turfsWithAvgRating = await Promise.all(
      allTurfs.map(async (turf) => {
        const reviews = await Review.find({ turf: turf._id });
        const totalRating = reviews.reduce(
          (sum, review) => sum + review.rating,
          0
        );
        const avgRating = reviews.length > 0 ? totalRating / reviews.length : 0;
        return {
          ...turf,
          avgRating: Number(avgRating.toFixed(1)),
        };
      })
    );

    return res.status(200).json({ 
      success: true, 
      message: "Turf updated successfully", 
      allTurfs: turfsWithAvgRating 
    });
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Delete turf by id as admin
export const adminDeleteTurfById = async (req, res) => {
  const admin = req.admin.role;
  if (admin !== "admin") {
    return res
      .status(403)
      .json({ success: false, message: "Unauthorized access denied" });
  }

  const { id } = req.params;

  try {
    const turf = await Turf.findById(id);
    if (!turf) {
      return res.status(404).json({ 
        success: false, 
        message: "Turf not found" 
      });
    }

    // Delete from database
    await Turf.findByIdAndDelete(id);

    // Get all remaining turfs with average ratings
    const allTurfs = await Turf.find().lean();
    const turfsWithAvgRating = await Promise.all(
      allTurfs.map(async (turf) => {
        const reviews = await Review.find({ turf: turf._id });
        const totalRating = reviews.reduce(
          (sum, review) => sum + review.rating,
          0
        );
        const avgRating = reviews.length > 0 ? totalRating / reviews.length : 0;
        return {
          ...turf,
          avgRating: Number(avgRating.toFixed(1)),
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
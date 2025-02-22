import Branch from "../../../models/Branch/Branch.model.js";
import SalesReceipt from "../../../models/invoice/SalesReceipt_Invoice/SalesReceipt.models.js";
import Product from "../../../models/product/FinalProduct/Product.models.js";
import Worker from "../../../models/user/worker/worker.models.js";
import mongoose from "mongoose";
import { sendSalesReceiptInvoiceMail } from "../../../utils/mail/salesReceiptInvoices.mail.js";

export const CreateSalesReceiptInvoice = async (req, res) => {
  try {
    const { staffId: AutherId } = req;
    const { branchId: BranchId } = req.params;
    const {
      CustomerName,
      Description,
      CustomerphoneNumber,
      mobileNumber,
      Customeremail,
      CustomerAddress,
      Note,
      SRNumber,
      date,
      tax = 0,
      paymentMethod,
      products,
      MessageToCustomer,
      MessageToStatement,
    } = req.body;

    // Validate required fields
    if (
      !AutherId ||
      !BranchId ||
      !CustomerName ||
      !SRNumber ||
      !products ||
      !Array.isArray(products) ||
      products.length === 0
    ) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Missing required fields or invalid products data",
      });
    }

    // Validate each product in the array
    for (const product of products) {
      if (
        !product.productId ||
        !product.quantity ||
        typeof product.quantity !== "number" ||
        product.quantity <= 0 ||
        typeof product.discount !== "number" ||
        product.discount < 0
      ) {
        return res.status(400).json({
          success: false,
          error: true,
          message: "Invalid product data",
        });
      }
    }

    // Fetch author details
    const AutherData = await Worker.findById(AutherId);
    if (!AutherData)
      return res
        .status(404)
        .json({ success: false, error: true, message: "Author not found" });

    // Authorization check
    if (!["Manager", "Admin"].includes(AutherData.role)) {
      return res.status(403).json({
        success: false,
        error: true,
        message: "Unauthorized access",
      });
    }

    // Fetch branch details
    const BranchData = await Branch.findById(BranchId);
    if (!BranchData)
      return res
        .status(404)
        .json({ success: false, error: true, message: "Branch not found" });

    // Admin should not create invoices for unrelated branches
    if (AutherData.role !== "Admin") {
      if (AutherData.BranchId.toString() !== BranchData._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized to upload a final product",
        });
      }
    }

    // Check if SRNumber already exists (only SRNumber is unique)
    const existingInvoice = await SalesReceipt.findOne({ SRNumber });
    if (existingInvoice) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "SR Number already exists",
      });
    }

    let subtotal = 0;
    const validatedProducts = await Promise.all(
      products.map(async (product) => {
        const productData = await Product.findById(product.productId);
        if (!productData) {
          throw new Error(`Product with ID ${product.productId} not found`);
        }

        const totalPrice =
          product.quantity * productData.productPrice - product.discount;
        subtotal += totalPrice;

        return {
          productId: product.productId,
          quantity: product.quantity,
          unitPrice: productData.productPrice,
          discount: product.discount,
          totalPrice: totalPrice,
        };
      })
    );

    const totalTax = (subtotal * tax) / 100;
    const grandTotal = subtotal + totalTax;

    const SalesReceiptInvoice = new SalesReceipt({
      BranchId: BranchId,
      salesReceiptCreatedBy: AutherId,
      CustomerName,
      SRNumber,
      date,
      paymentMethod,
      products: validatedProducts,
      grandTotal,
      Note,
      tax,
      Description,
      CustomerphoneNumber: CustomerphoneNumber || null,
      mobileNumber: mobileNumber || BranchData.branchPhoneNumber,
      Customeremail: Customeremail || null,
      CustomerAddress,
      MessageToCustomer,
      MessageToStatement,
    });

    const result = await SalesReceiptInvoice.save();

    const populateData = await SalesReceipt.findById(result._id)
      .populate("salesReceiptCreatedBy", "fullName email phoneNumber role")
      .populate(
        "products.productId",
        "productName productPrice productCategory productQuantity"
      )
      .populate("BranchId", "branchName address phoneNumber");

    // Update branch with the new sales receipt invoice
    BranchData.SalesReceiptInvoices.push(result._id);
    await BranchData.save();

    // Send email
    await sendSalesReceiptInvoiceMail(
      Customeremail,
      CustomerName,
      AutherData.email,
      AutherData.fullName,
      SRNumber,
      date,
      paymentMethod,
      validatedProducts.map((product) => ({
        productName: product.productId.productName,
        quantity: product.quantity,
        unitPrice: product.unitPrice,
        discount: product.discount || 0,
        totalPrice: product.totalPrice,
      })),
      subtotal,
      tax,
      grandTotal,
      BranchData.branchName,
      BranchData.branchPhoneNumber,
      BranchData.address
    );

    return res.status(201).json({
      success: true,
      message: "Sales receipt invoice created successfully",
      data: populateData,
    });
  } catch (error) {
    console.error(`Error in CreateSalesReceiptInvoice: ${error.message}`);
    console.error(error.stack); // Log the stack trace
    return res.status(500).json({
      success: false,
      error: true,
      message: "Internal server error",
    });
  }
};

export const UpdateSalesReceiptInvoice = async (req, res) => {
  try {
    const AutherId = req.staffId;
    const SalesReceiptId = req.params.salesReceiptInvoiceId;
    const {
      CustomerName,
      SRNumber,
      date,
      paymentMethod,
      ProductId,
      MessageToCustomer,
      MessageToStatement,
      quantity,
      discount = 0,
    } = req.body;
    if (!AutherId) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Missing required fields",
      });
    }
    if (!SalesReceiptId) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Missing required fields",
      });
    }
    if (!mongoose.Types.ObjectId.isValid(SalesReceiptId)) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Invalid SalesReceiptId",
      });
    }
    if (!mongoose.Types.ObjectId.isValid(AutherId)) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Invalid AutherId",
      });
    }
    const AutherData = await Worker.findById(AutherId);
    if (!AutherData) {
      return res.status(404).json({
        success: false,
        error: true,
        message: "Author not found",
      });
    }

    if (AutherData.role !== "Admin" && AutherData.role !== "Manager") {
      return res.status(403).json({
        success: false,
        error: true,
        message: "You are not authorized to update this sales receipt invoice",
      });
    }

    if (AutherData.role !== "Admin") {
      if (AutherData._id.toString() !== AutherData.BranchStaff.toString()) {
        return res.status(403).json({
          success: false,
          error: true,
          message:
            "You are not authorized to update this sales receipt invoice",
        });
      }
    }

    const SalesReceiptData = await SalesReceipt.findById(SalesReceiptId);
    if (!SalesReceiptData) {
      return res.status(404).json({
        success: false,
        error: true,
        message: "Sales receipt invoice not found",
      });
    }

    let finalPrice = 0;
    let unitPrice = 0;
    if (ProductId) {
      const ProductData = await Product.findById(ProductId);
      if (!ProductData) {
        return res.status(404).json({
          success: false,
          error: true,
          message: "Product not found",
        });
      }
      finalPrice = quantity * ProductData.productPrice - discount;
      unitPrice = ProductData.productPrice;
    }

    if (CustomerName !== undefined)
      SalesReceiptData.CustomerName = CustomerName;
    if (SRNumber !== undefined) SalesReceiptData.SRNumber = SRNumber;
    if (unitPrice !== undefined) SalesReceiptData.unitPrice = unitPrice;
    if (date !== undefined) SalesReceiptData.date = date;
    if (paymentMethod !== undefined)
      SalesReceiptData.paymentMethod = paymentMethod;
    if (ProductId !== undefined) SalesReceiptData.ProductId = ProductId;
    if (MessageToCustomer !== undefined)
      SalesReceiptData.MessageToCustomer = MessageToCustomer;
    if (MessageToStatement !== undefined)
      SalesReceiptData.MessageToStatement = MessageToStatement;
    if (quantity !== undefined) SalesReceiptData.quantity = quantity;
    if (discount !== undefined) SalesReceiptData.discount = discount;
    if (finalPrice !== undefined) SalesReceiptData.totalAmount = finalPrice;

    await SalesReceiptData.save();

    const populateData = await SalesReceipt.findById(SalesReceiptId)
      .populate("salesReceiptCreatedBy", "fullName email phoneNumber role")
      .populate(
        "ProductId",
        "productName productPrice productCategory productQuantity"
      )
      .populate("BranchId", "branchName address");

    return res.status(200).json({
      success: true,
      error: false,
      message: "Sales receipt invoice updated successfully",
      data: populateData,
    });
  } catch (error) {
    console.error(`Error in UpdateSalesReceiptInvoice: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: true,
      message: `Internal server error ${error.message}`,
    });
  }
};

// only Admin
export const getAllSalesReceiptInvoice = async (req, res) => {
  try {
    const AutherId = req.staffId;
    if (!AutherId) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Missing required fields",
      });
    }
    if (!mongoose.Types.ObjectId.isValid(AutherId)) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Invalid AutherId",
      });
    }

    const AutherData = await Worker.findById(AutherId);
    if (!AutherData) {
      return res.status(404).json({
        success: false,
        error: true,
        message: "Author not found",
      });
    }

    if (AutherData.role !== "Admin") {
      return res.status(403).json({
        success: false,
        error: true,
        message: "You are not authorized to get this sales receipt invoice",
      });
    }

    const AllSalesReceiptInvoices = await SalesReceipt.find()
      .limit(10)
      .populate("salesReceiptCreatedBy", "fullName email phoneNumber role")
      .populate(
        "ProductId",
        "productName productPrice productCategory productQuantity"
      )
      .populate("BranchId", "branchName address");

    return res.status(200).json({
      success: true,
      error: false,
      message: "Sales receipt invoice fetched successfully",
      data: AllSalesReceiptInvoices,
    });
  } catch (error) {
    console.error(`Error in getAllSalesReceiptInvoice: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: true,
      message: `Internal server error ${error.message}`,
    });
  }
};

export const GetAllSalesReceiptInvoiceOnBranch = async (req, res) => {
  try {
    const AutherId = req.staffId;
    const branchId = req.params.branchId;
    if (!AutherId) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Missing required fields",
      });
    }
    if (!branchId) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Missing required fields",
      });
    }
    if (!mongoose.Types.ObjectId.isValid(AutherId)) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Invalid AutherId",
      });
    }
    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Invalid branchId",
      });
    }

    const AutherData = await Worker.findById(AutherId);
    if (!AutherData) {
      return res.status(404).json({
        success: false,
        error: true,
        message: "Author not found",
      });
    }
    if (AutherData.role !== "Admin" && AutherData.role !== "Manager") {
      return res.status(403).json({
        success: false,
        error: true,
        message: "You are not authorized to get this sales receipt invoice",
      });
    }
    const BranchData = await Branch.findById(branchId);
    if (AutherData.role !== "Admin") {
      if (!BranchData) {
        return res.status(404).json({
          success: false,
          error: true,
          message: "Branch not found",
        });
      }
    }

    if (AutherData.role !== "Admin") {
      if (AutherData._id.toString() !== AutherData.BranchStaff.toString()) {
        return res.status(403).json({
          success: false,
          error: true,
          message: "You are not authorized to get this sales receipt invoice",
        });
      }
    }

    const AllSalesReceiptInvoices = await SalesReceipt.find({
      BranchId: branchId,
    })
      .limit(10)
      .populate("salesReceiptCreatedBy", "fullName email phoneNumber role")
      .populate("BranchId", "branchName address");
    return res.status(200).json({
      success: true,
      error: false,
      message: "Sales receipt invoice fetched successfully",
      data: AllSalesReceiptInvoices,
    });
  } catch (error) {
    console.error(
      `Error in GetAllSalesReceiptInvoiceOnBranch: ${error.message}`
    );
    return res.status(500).json({
      success: false,
      error: true,
      message: `Internal server error ${error.message}`,
    });
  }
};

export const getOneSalesReceiptInvoice = async (req, res) => {
  try {
    const AutherId = req.staffId;
    const SalesReceiptId = req.params.expenseInvoiceId;
    console.log(SalesReceiptId);
    if (!AutherId) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Missing required fields",
      });
    }
    if (!SalesReceiptId) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Missing required fields",
      });
    }
    if (!mongoose.Types.ObjectId.isValid(SalesReceiptId)) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Invalid ProductId",
      });
    }
    if (!mongoose.Types.ObjectId.isValid(AutherId)) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Invalid AutherId",
      });
    }

    const AutherData = await Worker.findById(AutherId);
    if (!AutherData) {
      return res.status(404).json({
        success: false,
        error: true,
        message: "Author not found",
      });
    }
    if (AutherData.role !== "Admin") {
      const BranchId = AutherData.BranchId;
      const BranchData = await Branch.findById(BranchId);
      if (BranchData._id.toString() !== AutherData.BranchId.toString()) {
        return res.status(403).json({
          success: false,
          error: true,
          message: "You are not authorized to get this product details",
        });
      }
    }
    const populateData = await SalesReceipt.findById(SalesReceiptId)
      .populate("salesReceiptCreatedBy", "fullName email phoneNumber role")
      .populate("BranchId", "branchName address");
    return res.status(200).json({
      success: true,
      error: false,
      message: "Product details fetched successfully",
      data: populateData,
    });
  } catch (error) {
    console.log(`Error in getOneProductDetails: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: true,
      message: `Internal server error ${error.message}`,
    });
  }
};

export const deleteSalesReceiptInvoice = async (req, res) => {
  try {
    const AutherId = req.staffId;
    const SalesReceiptId = req.params.salesReceiptInvoiceId;
    if (!AutherId) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Missing required fields",
      });
    }
    if (!mongoose.Types.ObjectId.isValid(AutherId)) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Invalid AutherId",
      });
    }

    const AutherData = await Worker.findById(AutherId);
    if (!AutherData) {
      return res.status(404).json({
        success: false,
        error: true,
        message: "Author not found",
      });
    }

    if (AutherData.role !== "Admin") {
      return res.status(403).json({
        success: false,
        error: true,
        message: "You are not authorized to delete this sales receipt invoice",
      });
    }
    const SalesReceiptData = await SalesReceipt.findById(SalesReceiptId);
    if (!SalesReceiptData) {
      return res.status(404).json({
        success: false,
        error: true,
        message: "Sales receipt invoice not found",
      });
    }
    await SalesReceipt.findByIdAndDelete(SalesReceiptId);
    return res.status(200).json({
      success: true,
      error: false,
      message: "Sales receipt invoice deleted successfully",
    });
  } catch (error) {
    console.error(`Error in deleteSalesReceiptInvoice: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: true,
      message: `Internal server error ${error.message}`,
    });
  }
};

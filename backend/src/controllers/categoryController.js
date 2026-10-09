import {
  listCategories as listCategoriesService,
  createCategory as createCategoryService,
  updateCategory as updateCategoryService,
  deleteCategory as deleteCategoryService
} from "../services/categoryService.js";

export const listCategories = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const items = await listCategoriesService({ orgId });
    res.json(items);
  } catch (err) {
    next(err);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const category = await createCategoryService({ orgId, payload: req.body });
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const { orgId, categoryId } = req.params;
    const category = await updateCategoryService({
      orgId,
      categoryId,
      payload: req.body
    });
    res.json(category);
  } catch (err) {
    next(err);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const { orgId, categoryId } = req.params;

    await deleteCategoryService({ orgId, categoryId });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

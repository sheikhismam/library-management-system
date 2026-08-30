import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Input, Button, Table, TableRow, TableCell, TableHead, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogTitle, AlertDialogDescription } from "../components";

const AuthorsCategoriesPage = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", type: "author" });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  // Fetch authors
  useEffect(() => {
    fetchAuthors();
  }, []);

  const fetchAuthors = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = {
        Authorization: `Bearer ${localStorage.getItem("access_token")}`,
      };
      const response = await fetch("/api/v1/authors/", { headers });
      if (!response.ok) throw new Error("Failed to fetch authors");
      const data = await response.json();
      setItems(data);
    } catch (err) {
      setError("Failed to load authors");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch categories
  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = {
        Authorization: `Bearer ${localStorage.getItem("access_token")}`,
      };
      const response = await fetch("/api/v1/categories/", { headers });
      if (!response.ok) throw new Error("Failed to fetch categories");
      const data = await response.json();
      // Add categories to items with type "category"
      setItems((prev) => [...prev, ...data.map((c) => ({ ...c, type: "category" }))]);
    } catch (err) {
      setError("Failed to load categories");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Save author/category
  const handleSave = async () => {
    try {
      const headers = {
        Authorization: `Bearer ${localStorage.getItem("access_token")}`,
      };
      if (editingId) {
        // Update
        await fetch(`/api/v1/${form.type}s/${editingId}/`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ name: form.name }),
        });
      } else {
        // Create
        await fetch(`/api/v1/${form.type}s/`, {
          method: "POST",
          headers,
          body: JSON.stringify({ name: form.name }),
        });
      }
      setShowForm(false);
      setForm({ name: "", type: form.type });
      if (form.type === "author") fetchAuthors();
      else fetchCategories();
    } catch (err) {
      alert("Failed to save");
      console.error(err);
    }
  };

  // Delete item
  const handleDelete = async (id, type) => {
    if (!confirm(`Are you sure you want to delete this ${type}?`)) return;
    try {
      const headers = {
        Authorization: `Bearer ${localStorage.getItem("access_token")}`,
      };
      await fetch(`/api/v1/${type}s/${id}/`, {
        method: "DELETE",
        headers,
      });
      if (type === "author") fetchAuthors();
      else fetchCategories();
    } catch (err) {
      alert("Failed to delete");
      console.error(err);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        Authors & Categories
      </h2>

      {/* Form toggle */}
      {showForm && (
        <div className="bg-white p-4 rounded-md shadow mb-4">
          <h3 className="font-medium text-lg text-gray-900 mb-4">
            {editingId ? "Edit" : "Add"} {form.type === "author" ? "Author" : "Category"}
          </h3>
          <form onSubmit={handleSave} className="space-y-3">
            <Input
              placeholder={editingId ? "New " + (form.type === "author" ? "Author" : "Category") : "Name"}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              disabled={loading}
              required
            />
            <div className="flex justify-end">
              <Button type="button" onClick={() => setShowForm(false)} className="mr-2">
                Cancel
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {editingId ? "Update" : "Add"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Toolbar: Add New */}
      <Button
        onClick={() => setShowForm(true)}
        className="mb-4 bg-indigo-600 hover:bg-indigo-700 text-white"
      >
        Add New
      </Button>

      {/* Table */}
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell className="text-right">Type</TableCell>
            <TableCell className="text-right">Actions</TableCell>
          </TableRow>
        </TableHead>
        {items.map((item) => (
          <TableRow key={item.id} className="border-b hover:bg-gray-50">
            <TableCell>{item.name}</TableCell>
            <TableCell className="text-sm text-gray-500">
              {item.type === "author" ? "Author" : "Category"}
            </TableCell>
            <TableCell className="text-right">
              <Button
                size="sm"
                className="text-sm text-gray-600 hover:text-gray-800"
                onClick={() => setEditingId(item.id)}
              >
                Edit
              </Button>
              <Button
                size="sm"
                className="ml-1 bg-red-100 hover:bg-red-200 text-red-600"
                onClick={() => handleDelete(item.id, item.type)}
              >
                Delete
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </Table>

      {/* Empty state */}
      {!loading && !items.length && (
        <p className="text-gray-500 mt-8">No authors or categories found.</p>
      )}
    </div>
  );
};

export default AuthorsCategoriesPage;
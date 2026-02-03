import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export interface Config {
  id: number;
  store_name: string;
  whatsapp_number: string;
}

export interface Category {
  id: number;
  name: string;
  display_order: number;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  image_url: string;
  category_id: number;
  in_stock: boolean;
}

type CatalogData = {
  config: Config | null;
  categories: Category[];
  products: Product[];
  loading: boolean;
  error: string | null;
};

export const useCatalog = () => {
  const [data, setData] = useState<CatalogData>({
    config: null,
    categories: [],
    products: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        // Fetch Config
        const { data: configData, error: configError } = await supabase
          .from("config")
          .select("*")
          .eq("id", 1)
          .single();

        if (configError) throw configError;

        // Fetch Categories
        const { data: categoriesData, error: categoriesError } = await supabase
          .from("categories")
          .select("*")
          .order("display_order", { ascending: true });

        if (categoriesError) throw categoriesError;

        // Fetch Products
        const { data: productsData, error: productsError } = await supabase
          .from("products")
          .select("*")
          .eq("in_stock", true);

        if (productsError) throw productsError;

        setData({
          config: configData,
          categories: categoriesData || [],
          products: productsData || [],
          loading: false,
          error: null,
        });
      } catch (error: any) {
        console.error("Error fetching catalog:", error);
        setData((prev) => ({
          ...prev,
          loading: false,
          error: error.message || "Error desconocido",
        }));
      }
    };

    fetchCatalog();
  }, []);

  return data;
};

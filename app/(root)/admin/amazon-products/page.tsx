import { requireAdmin } from "@/lib/auth/admin-auth";
import { prisma } from "@/lib/database/prisma";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

const ITEMS_PER_PAGE = 20;

export default async function AmazonProductsPage({
  searchParams,
}: {
  searchParams: { page?: string; asin?: string };
}) {
  const currentUser = await requireAdmin();
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">Admin access required</p>
        </div>
      </div>
    );
  }

  const currentPage = Number(searchParams?.page) || 1;
  const asinFilter = searchParams?.asin || undefined;
  const skip = (currentPage - 1) * ITEMS_PER_PAGE;

  const where: any = {};
  if (asinFilter) {
    where.asin = { contains: asinFilter, mode: "insensitive" };
  }

  const [products, total] = await Promise.all([
    prisma.amazonProduct.findMany({
      where,
      orderBy: {
        updatedAt: "desc",
      },
      take: ITEMS_PER_PAGE,
      skip,
    }),
    prisma.amazonProduct.count({ where }),
  ]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Amazon Products</h1>
              <p className="mt-1 text-sm text-gray-500">
                View products ingested from backfill actor
              </p>
            </div>
            <div className="text-sm text-gray-600">
              Total: <span className="font-semibold">{total}</span> products
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <form method="get" className="flex gap-4 items-end">
            <div className="flex-1">
              <label htmlFor="asin" className="block text-sm font-medium text-gray-700 mb-1">
                Filter by ASIN
              </label>
              <input
                type="text"
                id="asin"
                name="asin"
                defaultValue={asinFilter}
                placeholder="e.g., B0B8GJC25M"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
            >
              Search
            </button>
            {asinFilter && (
              <a
                href="/admin/amazon-products"
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Clear
              </a>
            )}
          </form>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ASIN
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rating
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Badges
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Imported
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      No products found
                    </td>
                  </tr>
                ) : (
                  products.map((product) => (
                    <tr key={product.asin} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {product.asin}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {product.mainImageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={product.mainImageUrl}
                              alt={product.title || "Product"}
                              width={48}
                              height={48}
                              className="w-12 h-12 object-cover rounded"
                            />
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-900 line-clamp-2">
                              {product.title || "No title"}
                            </div>
                            {product.brand && (
                              <div className="text-xs text-gray-500">{product.brand}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.currency || "$"} {product.salePrice?.toFixed(2) || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.averageRating ? (
                          <div>
                            <span className="font-medium">{product.averageRating}</span>
                            {product.totalRatings && (
                              <span className="text-gray-500 ml-1">
                                ({product.totalRatings.toLocaleString()})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-1 flex-wrap">
                          {product.isPrime && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              Prime
                            </span>
                          )}
                          {product.isAmazonChoice && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                              Choice
                            </span>
                          )}
                          {product.isBestSeller && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              Bestseller
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.updatedAt
                          ? format(new Date(product.updatedAt), "MMM d, yyyy HH:mm")
                          : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {product.productUrl && (
                          <a
                            href={product.productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-600 hover:text-purple-700 font-medium"
                          >
                            View on Amazon
                          </a>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {skip + 1} to {Math.min(skip + ITEMS_PER_PAGE, total)} of {total} products
              </div>
              <div className="flex gap-2">
                {currentPage > 1 && (
                  <a
                    href={`/admin/amazon-products?page=${currentPage - 1}${asinFilter ? `&asin=${asinFilter}` : ""}`}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Previous
                  </a>
                )}
                {currentPage < totalPages && (
                  <a
                    href={`/admin/amazon-products?page=${currentPage + 1}${asinFilter ? `&asin=${asinFilter}` : ""}`}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Next
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


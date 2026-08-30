import React from "react";

const Input = ({ className = "", ...props }) => (
  <input
    className={`rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-2 px-3 bg-white ${className}`}
    {...props}
  />
);

const Button = ({ size, className = "", children, ...props }) => {
  const sizeClass =
    size === "sm" ? "px-3 py-1 text-sm" : "px-4 py-2 text-sm";
  const baseClass =
    "inline-flex items-center justify-center rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  return (
    <button type="button" className={`${baseClass} ${sizeClass} ${className}`} {...props}>
      {children}
    </button>
  );
};

const Table = ({ children }) => {
  // Ensure valid table semantics: table > thead/tbody/tfoot > tr.
  // Rows passed directly to <Table> (outside an explicit thead/tbody/tfoot)
  // are wrapped in a <tbody> so the browser/React never see a bare <tr>
  // child of <table>.
  const sections = [];
  let bodyRows = [];

  const flushBody = () => {
    if (bodyRows.length) {
      sections.push(<tbody key={`tbody-${sections.length}`}>{bodyRows}</tbody>);
      bodyRows = [];
    }
  };

  React.Children.toArray(children).forEach((child) => {
    if (
      React.isValidElement(child) &&
      (child.type === "thead" ||
        child.type === "tbody" ||
        child.type === "tfoot" ||
        child.type === "caption" ||
        child.type === TableHead)
    ) {
      flushBody();
      sections.push(child);
    } else {
      bodyRows.push(child);
    }
  });
  flushBody();

  return (
    <table className="min-w-full divide-y divide-gray-200 bg-white rounded-lg overflow-hidden shadow-sm">
      {sections}
    </table>
  );
};

const TableHead = ({ children }) => <thead className="bg-gray-50">{children}</thead>;

const TableRow = ({ children, className = "" }) => (
  <tr className={`border-b ${className}`}>{children}</tr>
);

const TableCell = ({ children, className = "" }) => (
  <td className={`px-4 py-3 text-sm text-gray-900 ${className}`}>{children}</td>
);

const LogoutButton = ({ onLogout }) => (
  <button
    onClick={onLogout}
    className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-700 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
  >
    Logout
  </button>
);

const AlertDialog = ({ children }) => <div>{children}</div>;
const AlertDialogContent = ({ children }) => (
  <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">{children}</div>
);
const AlertDialogTitle = ({ children }) => (
  <h3 className="text-lg font-semibold text-gray-900 mb-2">{children}</h3>
);
const AlertDialogDescription = ({ children }) => (
  <p className="text-sm text-gray-500 mb-4">{children}</p>
);
const AlertDialogAction = ({ children, ...props }) => (
  <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" {...props}>
    {children}
  </Button>
);
const AlertDialogCancel = ({ children, ...props }) => (
  <Button className="bg-gray-100 hover:bg-gray-200 text-gray-700 mr-2" {...props}>
    {children}
  </Button>
);

const Modal = ({ children, onClose, maxWidth = "max-w-md" }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className={`relative w-full ${maxWidth} bg-white rounded-lg shadow-xl`}>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 focus:outline-none text-lg leading-none"
      >
        ×
      </button>
      {children}
    </div>
  </div>
);

export {
  Input,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  LogoutButton,
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
  Modal,
};